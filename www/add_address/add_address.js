angular.module('foodMeApp.addAddress', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/add_address', {
    templateUrl: 'add_address/add_address.html',
    controller: 'AddAddressCtrl'
  });
}])

.controller('AddAddressCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState) {
  $scope.userToken = fmaLocalStorage.getObject('userToken');
  if (!fmaSharedState.use_desktop && !_.has($scope.userToken, 'access_token')) {
    $location.path('/intro_screen');
    return;
  }
  // Create a forms object that we can attach our form to in the view.
  $scope.forms = {};
  // These are the address fields we will need to send to delivery.com
  $scope.addressFields = {
    streetAddress: "",
    apartmentNumber: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
  };
  // The states are hardcoded in our shared state.
  $scope.possibleStates = fmaSharedState.possibleStates;
  // When the done button is pressed, we validate all the fields, then try to
  // send them to delivery.com.
  $scope.doneButtonPressed = function() {
    console.log('Done button pressed.');
    // Attempt to save. If can save, go back to the address selection page. If
    // not, pop up an alert explaining why.
    if ($scope.forms.newAddressForm.$error.required) {
      console.log('Missing fields.');
      console.log($scope.forms.newAddressForm.$error);
      alert('You have missing fields! Fill them in so you can food...');
      return;
    }
    // If we're on the desktop, just route back without trying to update
    // delivery.com.
    if (fmaSharedState.use_desktop) {
      $location.path('/choose_address');
      return;
    }

    // TODO(daddy): Try to get the fields validated by delivery.com and create
    // a real user location.
    $http.defaults.headers.common.Authorization = $scope.userToken.access_token;
    //$http.get('https://api.delivery.com/customer/location?client_id=' + fmaSharedState.client_id).then(
    //function(res) {
      //$scope.locationList = res.data.locations;
      //alert(JSON.stringify($scope.locationList));
    //},
    //function(err) {
      //alert('Error fetching addresses: ' + err.statusText);
      //// This is a hack since we don't refresh our token.
      //fmaLocalStorage.setObject('userToken', null);
      //$location.path('/intro_screen');
    //});
    $location.path('/choose_address');
  };
  $scope.cancelButtonPressed = function() {
    console.log('Cancel button pressed.');
    $location.path('/choose_address');
  };
  
}]);
