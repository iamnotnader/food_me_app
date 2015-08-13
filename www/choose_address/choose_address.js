angular.module('foodMeApp.chooseAddress', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/choose_address', {
    templateUrl: 'choose_address/choose_address.html',
    controller: 'ChooseAddressCtrl'
  });
}])

.controller('ChooseAddressCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState",
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

  // The location the user wants to use when looking for restaurants. This is an
  // object so we can use it in ng-repeat without scope issues.
  $scope.selectedLocationIndex = { value: null };
  $scope.locationList = {};
  $http.defaults.headers.common.Authorization = $scope.rawAccessToken;
  $http.get('https://api.delivery.com/customer/location?client_id=' + fmaSharedState.client_id).then(
  function(res) {
    $scope.locationList = res.data.locations;
    console.log(JSON.stringify($scope.locationList));
    var currentAddress = fmaLocalStorage.getObject('userAddress');
    for (var i = 0; i < $scope.locationList.length; i++) {
      if ($scope.locationList[i].location_id === currentAddress.location_id) {
        $scope.selectedLocationIndex.value = i;
        break;
      }
    }
  },
  function(err) {
    alert('Error fetching addresses: ' + err.statusText);
    // This is a hack since we don't refresh our token.
    fmaLocalStorage.setObject('userToken', null);
    fmaSharedState.fake_token = null;
    console.log("Using an expired token!");
    $location.path('/intro_screen');
  });

  $scope.doneButtonPressed = function() {
    console.log('Done button pressed.');
    // Save the chosen address and proceed.
    var chosenLocIndex = $scope.selectedLocationIndex.value;
    if (chosenLocIndex !== null) {
      console.log("Setting userAddress!");
      fmaLocalStorage.setObjectWithExpirationSeconds(
          'userAddress', $scope.locationList[chosenLocIndex],
          fmaSharedState.testing_invalidation_seconds);
      $location.path('/choose_cuisine');
      return;
    }
    console.log("Need to select an address.");
    alert("Dude. You have to select an address.");
  };
  $scope.addAddressButtonPressed = function() {
    console.log('Add address button pressed.');
    $location.path('/add_address');
  };

  // Set the selected location index when a user taps a cell.
  $scope.cellSelected = function(indexSelected) {
    console.log('Cell selected: ' + indexSelected);
    $scope.selectedLocationIndex.value = indexSelected;
  };
  
}]);
