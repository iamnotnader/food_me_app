/* jshint eqnull: true */

angular.module('foodMeApp.addCard', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

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
    if (dataObj.exp_year.length !== 4) {
      if (dataObj.exp_year.length === 2) {
        dataObj.exp_year = '20' + dataObj.exp_year;
      } else {
        alert ('Credit card expiration year must be four digits! Try again?');
        return;
      }
    }

    // You'll notice this isn't using $http() below. That's because I had a
    // bug that made me really mad and I figured as a last-ditch effort I'd
    // just rewrite the darn thing using $.ajax. Well, that worked so I left
    // it. Yay debt!
    $scope.isLoading = true;
    $.ajax({
      method: "POST",
      url: fmaSharedState.endpoint + '/customer/cc',
      datatype : "json",
      contentType: "application/json; charset=utf-8",
      data: JSON.stringify(dataObj),
      headers: {
        "Authorization": $scope.rawAccessToken,
      },
      success: function(res, statusObj, xhr) {
        $scope.isLoading = false;
        $scope.$apply();
        if (res.message != null && res.message.length > 0) {
          alert(res.message[0].dev_msg);
          return;
        }
        alert('Successfully added your card!');
        mainViewObj.removeClass();
        mainViewObj.addClass('slide-right');
        $location.path('choose_card');
        return;
      },
      error: function(xhr, statusObj, error) {
        $scope.isLoading = false;
        $scope.$apply();
        if (xhr.responseJSON != null && xhr.responseJSON.message != null &&
            xhr.responseJSON.message.dev_msg != null) {
          alert(xhr.responseJSON.message.dev_msg);
          return;
        }
        alert('Whoops! We had an error. This is probably due to network ' +
              'connectivity so just try again and it should work!');

      },
      complete: function(xhr, statusObj) {
      }
    });
  };
}]);
