/*jshint eqnull: true */
angular.module('foodMeApp.chooseCard', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState', 'foodmeApp.cartHelper'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/choose_card', {
    templateUrl: 'choose_card/choose_card.html',
    controller: 'ChooseCardCtrl'
  });
}])

.controller('ChooseCardCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$rootScope", "$timeout", "$q", "$route",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $rootScope, $timeout, $q, $route) {
  var mainViewObj = $('#main_view_container');

  // On this screen, we need a valid user token. If we are missing one, we need
  // to go back to the intro_screen to get it.
  //
  // We also need a nonempty cart, but that should be naturally enforced by the
  // last page. Just in case, though...
  console.log('In choose_card controller.');
  $scope.userToken = fmaLocalStorage.getObject('userToken');
  $scope.rawAccessToken = null;
  if (fmaSharedState.fake_token) {
    alert('Warning-- you are using a fake access token.');
    console.log('Fake access token being used.');
    $scope.rawAccessToken = fmaSharedState.fake_token;
  } else if ($scope.userToken != null && _.has($scope.userToken, 'access_token')) {
    $scope.rawAccessToken = $scope.userToken.access_token;
  }
  if ($scope.rawAccessToken === null) {
    alert('In order to choose an address, we need you to log in first.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/intro_screen');
    return;
  }
  $scope.userCart = fmaLocalStorage.getObject('userCart');
  if ($scope.userCart == null || $scope.userCart.length === 0) {
    // We redirect to the cart page if the cart is empty.
    alert('We need something in your cart first.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/cart_page');
    return;
  }
  // If we get here, we have a valid user token AND userCart is nonempty.

  $scope.isLoading = true;
  var loadStartTime = (new Date()).getTime();
  $scope.cardList = [];
  $scope.selectedCardIndex = { value: null };
  $http.defaults.headers.common.Authorization = $scope.rawAccessToken;
  $http.get(fmaSharedState.endpoint+'/customer/cc?client_id=' + fmaSharedState.client_id)
  .then(
    function(res) {
      $scope.cardList = res.data.cards;
      // Go through and fix up all of the exp_months to add padding.
      for (var i = 0; i < $scope.cardList.length; i++) {
        var cardInList = $scope.cardList[i];
        var pretty_exp_month = '' + cardInList.exp_month;
        if (pretty_exp_month.length === 1) {
          pretty_exp_month = '0' + pretty_exp_month;
        }
        cardInList.pretty_exp_month = pretty_exp_month;
      }
      // Make the loading last at least a second.
      var timePassedMs = (new Date()).getTime() - loadStartTime;
      $timeout(function() {
        $scope.isLoading = false;
      }, Math.max(fmaSharedState.minLoadingMs - timePassedMs, 0));
    },
    function(err) {
      alert('Error fetching cards: ' + err.statusText);
      console.log(err);
      return;
  });

  $scope.chooseCardBackPressed = function() {
    console.log('Back button pressed.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('cart_page');
    return;
  };

  // This is probably the most critical piece of code in the whole app.
  // It's where we place an order and charge the card.
  var processPaymentPromise = function() {
    if (!fmaSharedState.takePayment) {
      return $q(function(resolve, reject) {
        alert('NOT ACTUALLY TAKING YOUR MONEY.');
        resolve('NOT TAKING PAYMENT.');
      });
    }
    // Everything below here only executes if fmaSharedState.takePayment = true.
    
    console.log('About to take money!');
    return $q(function(resolve, reject) {
      alert('Last chance-- you sure you want to do this?');
      resolve('TAKING PAYMENT.');
    });
  };

  var takeMoneyAndFinish = function() {
    $scope.isLoading = true;
    var loadStartTime = (new Date()).getTime();
    processPaymentPromise()
    .then(
      function(res) {
        // We were successful in processing the payment!
        console.log('Successfully processed order!');

        // Make the loading last at least a second.
        var timePassedMs = (new Date()).getTime() - loadStartTime;
        $timeout(function() {
          $scope.isLoading = false;
          alert("Thanks! I just took your money and your order will arrive in less " +
                "than half an hour. Unless it doesn't. It probably will, though, " +
                "maybe.");

          // Clear the user's cart.
          fmaLocalStorage.setObjectWithExpirationSeconds(
              'userCart', null,
              fmaSharedState.testing_invalidation_seconds);
          fmaLocalStorage.setObjectWithExpirationSeconds(
              'foodData', null,
              fmaSharedState.testing_invalidation_seconds);
          
          // Go back to the address page.
          mainViewObj.removeClass();
          mainViewObj.addClass('slide-right');
          $location.path('/choose_address');
        }, Math.max(fmaSharedState.minLoadingMs - timePassedMs, 0));
      },
      function() {
        // Make the loading last at least a second.
        var timePassedMs = (new Date()).getTime() - loadStartTime;
        $timeout(function() {
          $scope.isLoading = false;
        }, Math.max(fmaSharedState.minLoadingMs - timePassedMs, 0));
        alert("Huh.. There was a problem taking your payment.");
      }
    );
  };

  $scope.chooseCardFinishPressed = function() {
    console.log('Finish button pressed.');

    if ($scope.selectedCardIndex.value == null) {
      alert("SELECT A CARD. DO AS I SAY. I AM GOD.");
      return;
    }

    var foodNames = [];
    var sum = 0.0;
    for (var v1 = 0; v1 < $scope.userCart.length; v1++) {
      foodNames.push($scope.userCart[v1].name + ': $' + $scope.userCart[v1].price);
      sum += parseFloat($scope.userCart[v1].price);
    }
    confirm("Ready to order the following?\n\n" + foodNames.join('\n') +
            '\n\nFor a total of: $' + sum.toFixed(2) + '?',
      function(index) {
        if (index === 1) {
          takeMoneyAndFinish();
        }
      }
    );
    return;
  };

  // Set the selected location index when a user taps a cell.
  $scope.cellSelected = function(indexSelected) {
    console.log('Cell selected: ' + indexSelected);
    $scope.selectedCardIndex.value = indexSelected;
  };

  $scope.addCardButtonPressed = function() {
    console.log('Add card pressed!');
    var addCardUrl = fmaSharedState.endpoint+'/third_party/credit_card/add?' +
                    'client_id=' + fmaSharedState.client_id + '&' +
                    'redirect_uri=' + fmaSharedState.redirect_uri + '&' +
                    'response_type=code&' +
                    'scope=global&';

    var ref = window.open(addCardUrl, '_blank',
        'location=yes,transitionstyle=crossdissolve');
    ref.addEventListener('loadstart', function(event) {
      var url = event.url;
      if (url.indexOf(fmaSharedState.redirect_uri) === 0) {
        // We use $route.reload to force a reload of the card list.
        mainViewObj.removeClass();
        $route.reload();

        ref.close();
        return;
      }
    });
  };

}]);
