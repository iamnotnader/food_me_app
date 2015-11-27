/* jshint eqnull: true */

angular.module('foodMeApp.homePageV2', ['ngRoute', 'foodmeApp.localStorage', 'foodmeApp.sharedState', 'foodMeApp.stackHelper', 'ionic'])

.controller('HomePageV2Ctrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$q", "fmaStackHelper", "$timeout", "$interval", "$ionicPopup",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $q, fmaStackHelper, $timeout, $interval, $ionicPopup) {
  var topViewObj = $('#top_view_container');
  var subviewObj = $('#home_page_v2__subview_container');

  $scope.searchButtonPressed = function() {
    console.log('Search button pressed.');
    subviewObj.attr('class', 'slide-right');
    $('.swipe_page__bottom_bar').css({left: '0%'});
    $location.path('/home_page_v2/search_page_v2');
  };

  var homeButtonTransition = function () {
    $('.swipe_page__bottom_bar').css({left: '33.33333%'});
    if ($location.path() == "/home_page_v2/swipe_page_v2") {
      return;
    }
    if ($location.path() == "/home_page_v2/cart_page_v2") {
      subviewObj.attr('class', 'slide-right');
    } else {
      subviewObj.attr('class', 'slide-left');
    }
    $location.path('/home_page_v2/swipe_page_v2');
  };
  $scope.homeButtonPressed = function() {
    console.log('Refresh button pressed.');
    var currentSearch =
        JSON.stringify($scope.globals.selectedMerchantId) +
        JSON.stringify($scope.globals.deliveryMinimumLimit) +
        JSON.stringify($scope.globals.keywordValue);
    if ($scope.globals.lastSearch !== currentSearch &&
        $scope.globals.userCart.length > 0) {
      var confirmPopup = $ionicPopup.confirm({
        title: 'Burgie says...',
        template: 'Changing your search preferences will clear your cart. You sure you want to do that?',
        cancelText: 'Nah',
        okText: 'Yeah',
      });
      confirmPopup.then(function(res) {
        if(res) {
          $scope.globals.changeSearch();
          homeButtonTransition();
        } else {
          console.log('Not changing search.');
          // TODO(daddy): This is shit. I wrote this at 3am. There is almost definitely
          // a better way to do this. I was trying to make the search not change if the
          // user changes their mind about clearing their cart.
          $scope.globals.selectedMerchantId = $scope.globals.initialSearch.selectedMerchantId;
          $scope.globals.deliveryMinimumLimit = $scope.globals.initialSearch.deliveryMinimumLimit;
          $scope.globals.keywordValue = $scope.globals.initialSearch.keywordValue;
          homeButtonTransition();
        }
      });
      return;
    }
    homeButtonTransition();
  };
  $scope.cartButtonPressed = function() {
    console.log('Cart button pressed.');
    $('.swipe_page__bottom_bar').css({left: '66.66666%'});
    subviewObj.attr('class', 'slide-left');
    $location.path('/home_page_v2/cart_page_v2');
  };
  
  var saveSearchParams = function() {
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'selectedMerchantId', $scope.globals.selectedMerchantId,
        fmaSharedState.foodItemValidationSeconds);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'deliveryMinimumLimit', $scope.globals.deliveryMinimumLimit,
        fmaSharedState.testing_invalidation_seconds);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'keywordValue', $scope.globals.keywordValue,
        fmaSharedState.foodItemValidationSeconds);
  };
  var userCart = fmaLocalStorage.getObject('userCart');
  if (userCart == null) {
    userCart = [];
  }
  var computeCartTotal = function(cartArg) {
    var total = 0.0;
    for (var v1 = 0; v1 < cartArg.length; v1++) {
      total += parseFloat(cartArg[v1].price);
    }
    return total;
  };

  var changeSearch = function() {
    $scope.globals.saveSearchParams();
    $scope.globals.allMerchants = null;
    $scope.globals.allFoodItems = null;
  };
  var tutorialIndex = fmaLocalStorage.getObject('tutorialIndex');
  if (tutorialIndex == null) {
    tutorialIndex = 0;
  }
  var updateTutorialIndex = function(newIndex) {
    if (newIndex == null) {
      // Increment by one if newIndex is null.
      newIndex = $scope.globals.tutorialIndex + 1;
    }
    $scope.globals.tutorialIndex = newIndex;
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'tutorialIndex', $scope.globals.tutorialIndex,
        fmaSharedState.testing_invalidation_seconds);
  };
  $scope.globals = {
    userAddress: fmaLocalStorage.getObject('userAddress'),
    userCart: userCart,
    selectedMerchantId: fmaLocalStorage.getObject('selectedMerchantId'),
    deliveryMinimumLimit: fmaLocalStorage.getObject('deliveryMinimumLimit'),
    keywordValue: fmaLocalStorage.getObject('keywordValue'),
    saveSearchParams: saveSearchParams,
    itemIndex: fmaLocalStorage.getObject('stackItemIndex'),
    allFoodItems: fmaLocalStorage.getObject('allFoodItems'), 
    allMerchants: fmaLocalStorage.getObject('allMerchants'), 
    merchantIndex: fmaLocalStorage.getObject('stackMerchantIndex'), 
    lastAddress: fmaLocalStorage.getObject('lastAddress'),
    lastSearch: fmaLocalStorage.getObject('lastSearch'),
    computeCartTotal: computeCartTotal,
    minimumLeft: fmaLocalStorage.getObject('minimumLeft'),
    changeSearch: changeSearch,
    DEFAULT_MERCHANT_ID: "-1",
    tutorialIndex: tutorialIndex,
    updateTutorialIndex: updateTutorialIndex,
  };

  $scope.checkoutButtonPressed = function() {
    console.log('Checkout button pressed.');
    if ($scope.globals.userCart == null ||
        $scope.globals.userCart.length == 0) {
      var alertPopup = $ionicPopup.alert({
        title: 'Burgie says...',
        template: 'Bro. You need to add something to your cart first. Swipe right. The food loves you.',
        okText: 'Hush, burgie.',
      });
      return;
    }
    if ($scope.globals.minimumLeft > 0) {
      var alertPopup = $ionicPopup.alert({
        title: 'Burgie says...',
        template: 'Beat the delivery minimum first. Swipe right more. We believe in you.',
        okText: 'Hush, burgie.',
      });
      return;
    }

    // Save the state of the stack.
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'stackItemIndex', $scope.globals.itemIndex,
        fmaSharedState.foodItemValidationSeconds);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'allFoodItems', $scope.globals.allFoodItems,
        fmaSharedState.foodItemValidationSeconds);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'allMerchants', $scope.globals.allMerchants,
        fmaSharedState.foodItemValidationSeconds);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'stackMerchantIndex', $scope.globals.merchantIndex,
        fmaSharedState.foodItemValidationSeconds);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'lastAddress', $scope.globals.lastAddress,
        fmaSharedState.foodItemValidationSeconds);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'lastSearch', $scope.globals.lastSearch,
        fmaSharedState.foodItemValidationSeconds);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'minimumLeft', $scope.globals.minimumLeft,
        fmaSharedState.foodItemValidationSeconds);
    topViewObj.attr('class', 'slide-left');
    $location.path('/accounts_page');
    return;
  }

}]);
