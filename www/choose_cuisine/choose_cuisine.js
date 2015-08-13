angular.module('foodMeApp.chooseCuisine', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/choose_cuisine', {
    templateUrl: 'choose_cuisine/choose_cuisine.html',
    controller: 'ChooseCuisineCtrl'
  });
}])

.controller('ChooseCuisineCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState) {
  // TODO(daddy): This should really be some kind of pre-router hook or something.
  $scope.userToken = fmaLocalStorage.getObject('userToken');
  $scope.rawAccessToken = null;
  if (fmaSharedState.fake_token) {
    alert('Warning-- you are using a fake access token.');
    $scope.rawAccessToken = fmaSharedState.fake_token;
  } else if (_.has($scope.userToken, 'access_token')) {
    $scope.rawAccessToken = $scope.userToken.access_token;
  }
  if ($scope.rawAccessToken === null) {
    $location.path('/intro_screen');
    return;
  }
  if (!fmaLocalStorage.isSet('userAddress')) {
    throw new Error("In order to choose cuisines, you must first have an address.");
  }
  $scope.userAddress = fmaLocalStorage.getObject('userAddress');
  // When we get here, we have a valid user token and a valid address.

  console.log(JSON.stringify($scope.userAddress));
  $http.defaults.headers.common.Authorization = $scope.rawAccessToken;
  $http.get('https://api.delivery.com/merchant/search/delivery?' + 
            'client_id=' + fmaSharedState.client_id + '&' +
            'latitude=' + $scope.userAddress.latitude + '&' +
            'longitude=' + $scope.userAddress.longitude + '&' +
            'merchant_type=R&' +
            'access_token=' + $scope.rawAccessToken
  )
  .then(
  function(res) {
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'allNearbyMerchantData', res.data,
        fmaSharedState.testing_invalidation_seconds);
    $scope.all_cuisines = res.data.cuisines;
    $scope.all_cuisines.sort(function(a, b) {
      return b.count - a.count;
    });
    $scope.all_cuisines = $scope.all_cuisines.slice(0, 30);
  },

  function(err) {
    console.log('Error occurred.');
    console.log(JSON.stringify(err));
  });

  $scope.chooseCuisineBackPressed = function() {
    console.log('Back button pressed.');
    $location.path('choose_address');
    return;
  };

  $scope.chooseCuisineDonePressed = function() {
    console.log('Done button pressed.');
  };

  // The location the user wants to use when looking for restaurants. This is an
  // object so we can use it in ng-repeat without scope issues.
  $scope.selectedCuisineIndices = { value: [] };
  $scope.isSelected = function(index) {
    return $scope.selectedCuisineIndices.value.indexOf(index) != -1;
  };

  // Set the selected location index when a user taps a cell.
  $scope.cellTapped = function(indexTapped) {
    console.log('Cell tapped: ' + indexTapped);
    var chosenIndices = $scope.selectedCuisineIndices.value;
    if (chosenIndices.indexOf(indexTapped) != -1) {
      $scope.selectedCuisineIndices.value = _.without(chosenIndices, indexTapped);
      return;
    }
    chosenIndices.push(indexTapped);
  };
  
}]);
