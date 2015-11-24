/*jshint eqnull: true */
angular.module('foodMeApp.chooseCard', ['ngRoute', 'foodmeApp.localStorage', 'foodmeApp.sharedState', 'foodmeApp.cartHelper', 'ionic'])

.controller('ChooseCardCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$rootScope", "$timeout", "$q", "$route", "fmaCartHelper", "$ionicPopup",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $rootScope, $timeout, $q, $route, fmaCartHelper, $ionicPopup) {
  if (fmaSharedState.testModeEnabled) {
    alert('Warning-- you are using the sandbox.');
  }
  var topViewObj = $('#top_view_container');

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
    analytics.trackEvent('reroute', 'choose_card__intro_screen');

    var alertPopup = $ionicPopup.alert({
      title: 'Burgie says...',
      template: 'In order to choose a card, we need you to log in first.',
      okText: 'Hush, burgie.',
    });
    topViewObj.attr('class', 'slide-right');
    $location.path('/accounts_page');
    return;
  }
  $scope.userCart = fmaLocalStorage.getObject('userCart');
  if ($scope.userCart == null || $scope.userCart.length === 0) {
    analytics.trackEvent('reroute', 'choose_card__cart_page');

    // We redirect to the cart page if the cart is empty.
    var alertPopup = $ionicPopup.alert({
      title: 'Burgie says...',
      template: 'We need something in your cart first.',
      okText: 'Hush, burgie.',
    });
    topViewObj.attr('class', 'slide-right');
    $location.path('/home_page_v2/swipe_page_v2');
    return;
  }

  // If we get here, we have a valid user token AND userCart is nonempty AND
  // userAddress is populated (though may still need phone and apartment).

  analytics.trackView('/choose_card');

  $scope.cardsLoading = true;
  var loadStartTime = (new Date()).getTime();
  $scope.cardList = [];
  $scope.selectedCardIndex = { value: null };
  $http({
    method: 'GET',
    url: fmaSharedState.endpoint+'/customer/cc?client_id=' + fmaSharedState.client_id,
    headers: {
      'Authorization': $scope.rawAccessToken,
    }
  })
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
      if ($scope.cardList.length > 0) {
        $scope.cellSelected(0);
      }
      // Make the loading last at least a second.
      var timePassedMs = (new Date()).getTime() - loadStartTime;
      $timeout(function() {
        $scope.cardsLoading = false;
      }, Math.max(fmaSharedState.minLoadingMs - timePassedMs, 0));
    },
    function(err) {
      var alertPopup = $ionicPopup.alert({
        title: 'Burgie says...',
        template: 'Error fetching credit card numbers. This usually happens '+
                  'when you login to delivery.com outside of FoodMe. Just re-add ' +
                  'this account on the accounts page and '+
                  'everything should be fiiine.',
        okText: 'Hush, burgie.',
      });
      console.log(err);
      $scope.cardsLoading = false;
      return;
  });

  $scope.chooseCardBackPressed = function() {
    analytics.trackEvent('nav', 'choose_card__back_pressed');

    console.log('Back button pressed.');
    topViewObj.attr('class', 'slide-right');
    $location.path('accounts_page');
    return;
  };

  $scope.chooseCardFinishPressed = function() {
    analytics.trackEvent('nav', 'choose_card__finish_pressed');

    console.log('Finish button pressed.');

    if ($scope.selectedCardIndex.value == null) {
      var alertPopup = $ionicPopup.alert({
        title: 'Burgie says...',
        template: "SELECT A CARD. DO AS I SAY.",
        okText: 'Hush, burgie.',
      });
      return;
    }

    fmaLocalStorage.setObjectWithExpirationSeconds(
        'cardSelected', $scope.cardList[$scope.selectedCardIndex.value],
        fmaSharedState.testing_invalidation_seconds);

    topViewObj.attr('class', 'slide-left');
    $location.path('/add_phone');
    return;      
  };

  // Set the selected location index when a user taps a cell.
  $scope.cellSelected = function(indexSelected) {
    analytics.trackEvent('cell', 'choose_card__cell_selected');
    // This allows the user to toggle the check.
    if ($scope.selectedCardIndex.value === indexSelected) {
      $scope.selectedCardIndex.value = null;
      return;
    }

    console.log('Cell selected: ' + indexSelected);
    $scope.selectedCardIndex.value = indexSelected;
  };
  if ($scope.cardList.length > 0) {
    $scope.cellSelected(0);
  }

  $scope.addCardButtonPressed = function() {
    analytics.trackEvent('cell', 'choose_card__add_card_pressed');

    console.log('Add card pressed!');
    topViewObj.attr('class', 'slide-left');
    $location.path('/add_card');
    return;
  };

}]);
