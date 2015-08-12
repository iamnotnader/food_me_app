angular.module('foodMeApp.chooseAddress', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/choose_address', {
    templateUrl: 'choose_address/choose_address.html',
    controller: 'ChooseAddressCtrl'
  });
}])

.controller('ChooseAddressCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState) {
  $scope.userToken = fmaLocalStorage.getObject('userToken');
  if (!fmaSharedState.use_desktop && !_.has($scope.userToken, 'access_token')) {
    $location.path('/intro_screen');
    return;
  }
  // We special-case the desktop so we can test more easily.
  if (fmaSharedState.use_desktop) {
    $scope.locationList = [{
      street: '111 8th Ave',
      city: 'New York',
      state: 'NY',
      phone: '2127296389',
    },
    {
      street: '111 8th Ave',
      city: 'New York',
      state: 'NY',
      phone: '2127296389',
    }];
  } else {
    $scope.locationList = {};
    $http.defaults.headers.common.Authorization = $scope.userToken.access_token;
    $http.get('https://api.delivery.com/customer/location?client_id=' + fmaSharedState.client_id).then(
    function(res) {
      $scope.locationList = res.data.locations;
      alert(JSON.stringify($scope.locationList));
    },
    function(err) {
      alert('Error fetching addresses: ' + err.statusText);
      // This is a hack since we don't refresh our token.
      fmaLocalStorage.setObject('userToken', null);
      $location.path('/intro_screen');
    });
  }

  $scope.doneButtonPressed = function() {
    console.log('Done button pressed.');
  };
  $scope.addAddressButtonPressed = function() {
    console.log('Add address button pressed.');
    $location.path('/add_address');
  };
  // The location the user wants to use when looking for restaurants. This is an
  // object so we can use it in ng-repeat without scope issues.
  $scope.selectedLocationIndex = { value: null };
  // Set the selected location index when a user taps a cell.
  $scope.cellSelected = function(indexSelected) {
    console.log('Cell selected: ' + indexSelected);
    $scope.selectedLocationIndex.value = indexSelected;
  };
  
}]);
