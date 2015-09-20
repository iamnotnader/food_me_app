/* jshint eqnull: true */

angular.module('foodMeApp.accountsPage', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/accounts_page', {
    templateUrl: 'accounts_page/accounts_page.html',
    controller: 'AccountsPageCtrl'
  });
}])

.controller('AccountsPageCtrl', ["$scope", "$location", "$http", "fmaLocalStorage", 'fmaSharedState', '$rootScope', '$timeout',
function($scope, $location, $http, fmaLocalStorage, fmaSharedState, $rootScope, $timeout) {
  var mainViewObj = $('#main_view_container');
  if (window.analytics != null) {
    // For some reason deviceready doesn't execute fast enough sometimes.
    analytics.trackView('/accounts_page');
  }

  // Reset the state of the userToken and the auth cookie.
  $scope.accountsList = fmaLocalStorage.getObject('accountsList');
  if ($scope.accountsList == null) {
    $scope.accountsList = [];
  }
  $.removeCookie('userAuthToken')
  $scope.selectedAccountIndex = { value: null };

  var updateAccountsList = function(full_token) {
    // Maybe get the name and stuff here.
    $scope.isLoading = true;
    $http({
      method: 'GET',
      url: fmaSharedState.endpoint+'/customer/account?client_id='+fmaSharedState.client_id,
      headers: {
        'Authorization': full_token.access_token,
      }
    })
    .then(
      function(res) {
        $scope.selectedAccountIndex = { value: null };
        var newAccount = {
          token: full_token,
          user: res.data.user,
        };
        // Add the address to the recent addresses.
        $scope.accountsList = _.filter($scope.accountsList, function(item) {
          return item.user.email !== newAccount.user.email;
        });
        $scope.accountsList = [newAccount,].concat($scope.accountsList.slice(0, 10));

        // Save the account list in localStorage
        fmaLocalStorage.setObjectWithExpirationSeconds(
            'accountsList', $scope.accountsList,
            fmaSharedState.testing_invalidation_seconds);
        // Select the account to save time.
      if ($scope.accountsList.length > 0) {
        $scope.cellSelected(0);
      }
        $scope.isLoading = false;
      },
      function(err) {
        alert('A bad thing happened when setting up your account. '+
              'This is really rare-- just do it again!');
      }
    );
  }

  $scope.addAccountButtonPressed = function() {
    analytics.trackEvent('nav', 'accounts_page__add_account_pressed');
    console.log('Add account pressed.');

    // Do a dance to get a token for the used.
    // This is a hack but it looks like it's supported by Google...
    // Basically the flow is this:
    //   1) Open the delivery.com oauth page in a new webview.
    //   2) User types credentials
    //   3) delivery.com redirects to localhost:3000?code=blah
    //   4) We grab the value of code in the start listener then kill the
    //      webview.
    //
    // This URL gives us back an access code, which we can then exchange for an
    // access token. What follows is a dance between us and delivery.com to get
    // the sweet, sweet access token that we need to do everything.
    $scope.oauthUrl = fmaSharedState.oauth_endpoint+'/third_party/account/create?' +
                      'client_id=' + fmaSharedState.client_id + '&' +
                      'redirect_uri=' + fmaSharedState.redirect_uri + '&' +
                      'response_type=code&' +
                      'scope=payment,global&' +
                      'state=';
    var ref = window.open($scope.oauthUrl, '_blank',
        'location=no,transitionstyle=crossdissolve,clearcache=yes');
    ref.addEventListener('loadstart', function(event) {
      var url = event.url;
      if (url.indexOf(fmaSharedState.redirect_uri) === 0) {
        var code = /\?code=(.+)[&|$]/.exec(url);
        var error = /\?error=(.+)[&|$]/.exec(url);
        // We have to send like this instead of just doing $http.post because
        // the delivery.com API doesn't like JSON. See the comment at the top
        // of the controller. Note that this is obviously super insecure.
        $http({
          method: "post",
          url: fmaSharedState.oauth_endpoint+'/third_party/access_token',
          data: 'client_id='+fmaSharedState.client_id+'&' +
                'redirect_uri=http://localhost:3000&' +
                'grant_type=authorization_code&' +
                'client_secret=' + fmaSharedState.client_secret + '&' +
                'code=' + code[1],
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }).then(function(response) {
          updateAccountsList(response.data);
          return;
        }, function(error) {
          alert('Whoops! Something went wrong when logging in. ' +
                'Just restart the app and login again and it should ' +
                'work-- promise.');
        });
        ref.close();
      }
    });
    ref.addEventListener('loadstop', function(event) {
      var url = event.url;
      if (url.indexOf(fmaSharedState.redirect_uri) > 0) {
        // We only execute this block if the redirect_uri appears as a
        // parameter in the URL.
        var codeToAddFoodMePrivacyPolicy = (
          "var footer = document.querySelector('footer');" +
          "var header=document.querySelector('header > h1'); " +
          "header.innerHTML = header.innerHTML + '<br>By logging in " +
              "you agree to the FoodMe " +
              "<a href=\"http://www.foodme.io/#/privacy_page#topOfPage\">Privacy Policy</a>.<br><br>' + " +
              "footer.innerHTML; " +
          "footer.style.visibility = 'hidden';" +
          "header.style.lineHeight = '20px'; " +
          "header.style.margin = '15px 10px';" +
          "var disclaimer = document.querySelector('.disclaimer');" +
          "if (disclaimer != null) {" +
            "disclaimer.style.display = 'none';" +
          "}"
        );
        ref.executeScript({
            code: codeToAddFoodMePrivacyPolicy,
        }, function() {
        });
      }
    });
  };

  $scope.cellSelected = function(accountIndex) {
    $scope.selectedAccountIndex.value = accountIndex;
  }
  if ($scope.accountsList.length > 0) {
    $scope.cellSelected(0);
  }


  $scope.finishButtonPressed = function() {
    if ($scope.selectedAccountIndex.value == null) {
      alert('Bro. You need to select an account, bro.');
      return;
    }
    console.log('Finish pressed.');
    // Pick out the selected account.
    var selectedAccount = $scope.accountsList[$scope.selectedAccountIndex.value];
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'accountsList', $scope.accountsList,
        fmaSharedState.testing_invalidation_seconds);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userAccount', selectedAccount,
        fmaSharedState.testing_invalidation_seconds);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userToken', selectedAccount.token,
        fmaSharedState.testing_invalidation_seconds);
    // Need to transition to next page here.
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-left');
    $location.path('/choose_card');
    return;
  }

  $scope.backButtonPressed = function() {
    analytics.trackEvent('nav', 'accounts_page__back_pressed');

    console.log('Accounts back button pressed.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/cart_page');
  };
}]);
