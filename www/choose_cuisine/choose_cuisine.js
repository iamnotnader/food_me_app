angular.module('foodMeApp.chooseCuisine', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/choose_cuisine', {
    templateUrl: 'choose_cuisine/choose_cuisine.html',
    controller: 'ChooseCuisineCtrl'
  });
}])

.controller('ChooseCuisineCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState) {
  // For this controller, we need a token and an address. If we are missing
  // either one of those, we redirect to another screen in order to get it.
  console.log('In choose_cuisine controller.');
  $scope.userToken = fmaLocalStorage.getObject('userToken');
  $scope.rawAccessToken = null;
  if (fmaSharedState.fake_token) {
    alert('Warning-- you are using a fake access token.');
    console.log('Fake token being used.');
    $scope.rawAccessToken = fmaSharedState.fake_token;
  } else if (_.has($scope.userToken, 'access_token')) {
    console.log('Stored token being used.');
    $scope.rawAccessToken = $scope.userToken.access_token;
  }
  if ($scope.rawAccessToken === null) {
    alert('In order to set cuisines, we need you to log in first.');
    console.log('No token found-- go back to intro_screen.');
    $location.path('/intro_screen');
    return;
  }
  if (!fmaLocalStorage.isSet('userAddress')) {
    alert("In order to set cuisines, we need an address first. Please enter one.");
    console.log('No address found-- go back to choose_address to get it.');
    $location.path('/choose_address');
    return;
  }
  $scope.userAddress = fmaLocalStorage.getObject('userAddress');
  // When we get here, we have a valid user token and a valid address.

  $scope.isLoading = true;
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
    // Set the merchant data and reinitialize the chosen cuisines.
    res.data.cuisines.sort(function(a, b) {
      return b.count - a.count;
    });
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'allNearbyMerchantData', res.data,
        fmaSharedState.testing_invalidation_seconds);
    fmaLocalStorage.setObject('userCuisines', {});
    $scope.all_cuisines = res.data.cuisines;
    $scope.all_cuisines = $scope.all_cuisines.slice(0, 30);
    $scope.isLoading = false;
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
  
  $scope.chooseCuisineDonePressed = function() {
    console.log('Done button pressed.');
    if ($scope.selectedCuisineIndices.value.length === 0) {
      console.log('No cuisines selected.');
      alert('You must select at least one cuisine or no food.');
      return;
    }
    var cuisineIndices = $scope.selectedCuisineIndices.value;
    var userCuisines = [];
    for (var x = 0; x < cuisineIndices.length; x++) {
      userCuisines.push($scope.all_cuisines[cuisineIndices[x]]);
    }
    // These correspond directly to values in allNearbyMerchantData.cuisines.
    console.log(userCuisines);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCuisines', userCuisines,
        fmaSharedState.testing_invalidation_seconds);
    $location.path('/swipe_page');
    return;
  };

}]);
