/* jshint eqnull: true */

angular.module('foodMeApp.addCard', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/add_card', {
    templateUrl: 'add_card/add_card.html',
    controller: 'AddCardCtrl'
  });
}])

.controller('AddCardCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState) {
  var mainViewObj = $('#main_view_container');
  // For this page we need an access token. If we don't have one, we
  // need to go back to the selection page.
  $scope.userToken = fmaLocalStorage.getObject('userToken');
  $scope.rawAccessToken = null;
  if (fmaSharedState.fake_token) {
    alert('Warning-- you are using a fake access token.');
    $scope.rawAccessToken = fmaSharedState.fake_token;
  } else if (_.has($scope.userToken, 'access_token')) {
    $scope.rawAccessToken = $scope.userToken.access_token;
  }
  if ($scope.rawAccessToken === null) {
    analytics.trackEvent('reroute', 'add_address__intro_screen');

    // TODO(daddy): Add a direction animation here.
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/accounts_page');
    return;
  }


  // Create a forms object that we can attach our form to in the view.
  $scope.forms = {};
  // These are the address fields we will need to send to delivery.com
  $scope.cardFields = {
    cardNumber: "",
    expMonth: "",
    expYear: "",
    cvv: "",
    billingZip: "",
  };

  $scope.cancelPressed = function() {
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('choose_card');
    return;
  };

  $scope.addCardPressed = function() {
    console.log('Add card pressed!');
    var dataObj = {
      billing_zip: $scope.cardFields.billingZip,
      cc_number: $scope.cardFields.cardNumber,
      client_id: fmaSharedState.client_id,
      cvv: $scope.cardFields.cvv,
      exp_month: $scope.cardFields.expMonth,
      exp_year: $scope.cardFields.expYear,
    };
    if (isNaN(dataObj.cc_number) || dataObj.cc_number == null ||
        dataObj.cc_number.length === 0) {
      alert ('Credit card is invalid! Try again?');
      return;
    }
    if (isNaN(dataObj.exp_month) || dataObj.exp_month == null ||
        dataObj.exp_month.length !== 2) {
      alert ('Credit card expiration month must be two digits! Try again?');
      return;
    }
    if (isNaN(dataObj.exp_year) || dataObj.exp_year == null) {
      alert ('Credit card expiration year must be four digits! Try again?');
      return;
    }
    if (dataObj.exp_year.length !== 4) {
      if (dataObj.exp_year.length === 2) {
        dataObj.exp_year = '20' + dataObj.exp_year;
      } else {
        alert ('Credit card expiration year must be four digits! Try again?');
        return;
      }
    }
    if (isNaN(dataObj.billing_zip) || dataObj.billing_zip == null ||
        dataObj.billing_zip.length !== 5) {
      alert ('Zip code must be five digits! Try again?');
      return;
    }

    $scope.isLoading = true;
    $http({
      method: 'POST',
      url: fmaSharedState.endpoint + '/customer/cc',
      data: dataObj,
      headers: {
        "Authorization": $scope.rawAccessToken,
        "Content-Type": "application/json",
      }
    }).then(
      function(res) {
        mainViewObj.removeClass();
        mainViewObj.addClass('slide-right');
        $scope.isLoading = false;
        $location.path('choose_card');
        return;
      },
      function(err) {
        if (err.data != null && err.data.message != null && err.data.message.length > 0 &&
            err.data.message[0].user_msg != null) {
          alert(err.data.message[0].user_msg);
        } else {
          alert('One of the fields you entered was invalid. Try again!');
        }
        $scope.isLoading = false;
        return;
      }
    );
  };
}]);
