/* jshint eqnull: true */

angular.module('foodMeApp.homePageV2', ['ngRoute', 'foodmeApp.localStorage', 'foodmeApp.sharedState', 'foodMeApp.stackHelper', 'ionic'])

.controller('HomePageV2Ctrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$q", "fmaStackHelper", "$timeout", "$interval", "$ionicPopup",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $q, fmaStackHelper, $timeout, $interval, $ionicPopup) {
  $scope.searchButtonPressed = function() {
    console.log('Search button pressed.');
    $('.swipe_page__bottom_bar').css({left: '0%'});
    $location.path('/home_page_v2/search_page_v2');
  };
  $scope.homeButtonPressed = function() {
    console.log('Refresh button pressed.');
    $scope.globals.saveSearchParams();
    $('.swipe_page__bottom_bar').css({left: '33.33333%'});
    $location.path('/home_page_v2/swipe_page_v2');
  };
  $scope.cartButtonPressed = function() {
    console.log('Cart button pressed.');
    $('.swipe_page__bottom_bar').css({left: '66.66666%'});
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
  } ;
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
    DEFAULT_MERCHANT_ID: "-1",
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

    $location.path('/accounts_page');
    return;
  }
}]);
