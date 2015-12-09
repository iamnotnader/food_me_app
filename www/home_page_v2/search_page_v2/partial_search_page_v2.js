/* jshint eqnull: true */
angular.module('foodMeApp.searchPageV2', ['ngRoute', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.controller('SearchPageV2Ctrl', ["$scope", "$location", "$http", "fmaLocalStorage", 'fmaSharedState', '$rootScope', '$timeout', '$ionicPopup',
function($scope, $location, $http, fmaLocalStorage, fmaSharedState, $rootScope, $timeout, $ionicPopup) {
  var subviewObj = $('#home_page_v2__subview_container');
  // TODO(daddy): This is shit. I wrote this at 3am. There is almost definitely
  // a better way to do this. I was trying to make the search not change if the
  // user changes their mind about clearing their cart.
  $scope.globals.initialSearch = {
    selectedMerchantId: $scope.globals.selectedMerchantId,
    deliveryMinimumLimit: $scope.globals.deliveryMinimumLimit,
    keywordValue: $scope.globals.keywordValue,
  };

  // Sort all the merchants.
  $scope.sortedMerchants = [];
  if ($scope.globals.allMerchants != null) {
    $scope.sortedMerchants = _.sortBy($scope.globals.allMerchants, function(merchant){
      if (merchant == null || merchant.summary.name == null) {
        return 'ZZZ';
      }
      return merchant.summary.name;
    });
  }
  $scope.sortedMerchants.unshift({id: fmaSharedState.default_merchant_id, summary: { name: 'Any merchant.' } });

  // Set the selected merchantId if we have one.
  var merchantIdIsMissing = _.every(
    $scope.globals.allMerchants,
    function(merchant) {
      return merchant.id != $scope.globals.selectedMerchantId;
    }
  );
  if ($scope.globals.selectedMerchantId == null || merchantIdIsMissing) {
    $scope.globals.selectedMerchantId = fmaSharedState.default_merchant_id;
  } else {
    $scope.globals.selectedMerchantId = $scope.globals.selectedMerchantId;
  }

  // Set the keyword if we have it.
  $scope.globals.keywordValue = $scope.globals.keywordValue;

  // Set the delivery minimum limit if we have it.
  if ($scope.globals.deliveryMinimumLimit == null) {
    $scope.globals.deliveryMinimumLimit = fmaSharedState.defaultDeliveryMinimumLimit;
  } else {
    $scope.globals.deliveryMinimumLimit = $scope.globals.deliveryMinimumLimit;
  }

  $scope.selectDidChange = function() {
    // We have to clear the keyword. You can't do both at the same time.
    // TODO(daddy): Warn the user when clearing the keyword.
    $scope.globals.keywordValue = '';
  };
  $scope.keywordDidChange = function() {
    // We have to clear the select. You can't do both at the same time.
    // TODO(daddy): Warn the user when clearing the select.
    $scope.globals.selectedMerchantId = fmaSharedState.default_merchant_id;
  };
  $scope.clearKeywordPressed = function() {
    $scope.globals.keywordValue = '';
  };
  $scope.addToLimit = function() {
    $scope.globals.deliveryMinimumLimit++;
  };
  $scope.subtractFromLimit = function() {
    $scope.globals.deliveryMinimumLimit--;
  };

  var doneTransition = function() {
    $('.swipe_page__bottom_bar').css({left: '0'});
    subviewObj.attr('class', 'slide-left');
    $location.path('/home_page_v2/swipe_page_v2');
  };
  $scope.doneButtonPressed = function() {
    // Save our search variables and go back to the swipe page.
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
          doneTransition();
          return;
        } else {
          console.log('Not changing search.');
          // TODO(daddy): This is shit. I wrote this at 3am. There is almost definitely
          // a better way to do this. I was trying to make the search not change if the
          // user changes their mind about clearing their cart.
          $scope.globals.selectedMerchantId = $scope.globals.initialSearch.selectedMerchantId;
          $scope.globals.deliveryMinimumLimit = $scope.globals.initialSearch.deliveryMinimumLimit;
          $scope.globals.keywordValue = $scope.globals.initialSearch.keywordValue;

          doneTransition();
          return;
        }
      });
      return;
    }
    $scope.globals.changeSearch();
    doneTransition();
  };
}]);
