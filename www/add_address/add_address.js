angular.module('foodMeApp.addAddress', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/add_address', {
    templateUrl: 'add_address/add_address.html',
    controller: 'AddAddressCtrl'
  });
}])

.controller('AddAddressCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState",
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
  $scope.addAddressDonePressed = function() {
    console.log('Done button pressed.');

    var dataObj = {
      street: $scope.addressFields.streetAddress,
      city: $scope.addressFields.city,
      state: $scope.addressFields.state,
      zip_code: $scope.addressFields.zip,
      phone: $scope.addressFields.phone,
      unit_number: $scope.addressFields.apartmentNumber,
    };
    console.log(JSON.stringify(dataObj));
    console.log($scope.rawAccessToken);
    $http({
      method: 'POST',
      url: 'https://api.delivery.com/customer/location?client_id=' + fmaSharedState.client_id,
      data: dataObj,
      headers: {
        "Authorization": $scope.rawAccessToken,
        "Content-Type": "application/json",
      }
    })
    .then(
      function(res) {
        console.log('Successfully added address.');
        console.log(JSON.stringify(res));
        $location.path('/choose_address');
      },
      function(err) {
        console.log('Error adding address.');
        console.log(JSON.stringify(err));
        if (!err.data.message) {
          alert("A weeeird error occurred. Going to be real with you here-- " +
                "not quite sure what happened but it's probably a " +
                "connectivity issue, which isn't my fault.");
          return;
        }
        alert(err.data.message[0].user_msg);
        return;
    });
  };

  $scope.addAddressCancelPressed = function() {
    console.log('Cancel button pressed.');
    $location.path('/choose_address');
  };
  
}]);
