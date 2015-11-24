/* jshint eqnull: true */
angular.module('foodMeApp.searchPageV2', ['ngRoute', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.controller('SearchPageV2Ctrl', ["$scope", "$location", "$http", "fmaLocalStorage", 'fmaSharedState', '$rootScope', '$timeout',
function($scope, $location, $http, fmaLocalStorage, fmaSharedState, $rootScope, $timeout) {
  var subviewObj = $('#home_page_v2__subview_container');

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
  $scope.sortedMerchants.unshift({id: $scope.globals.DEFAULT_MERCHANT_ID, summary: { name: 'Any merchant.' } });

  // Set the selected merchantId if we have one.
  var merchantIdIsMissing = _.every(
    $scope.globals.allMerchants,
    function(merchant) {
      return merchant.id != $scope.globals.selectedMerchantId;
    }
  );
  if ($scope.globals.selectedMerchantId == null || merchantIdIsMissing) {
    $scope.globals.selectedMerchantId = $scope.globals.DEFAULT_MERCHANT_ID;
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
    $scope.globals.selectedMerchantId = $scope.globals.DEFAULT_MERCHANT_ID;
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

  $scope.doneButtonPressed = function() {
    // Save our search variables and go back to the swipe page.
    $scope.globals.saveSearchParams();
    $('.swipe_page__bottom_bar').css({left: '33.33333%'});
    subviewObj.attr('class', 'slide-left');
    $location.path('/home_page_v2/swipe_page_v2');
    return;
  };
}]);
