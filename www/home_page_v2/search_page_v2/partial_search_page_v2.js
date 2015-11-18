/* jshint eqnull: true */
angular.module('foodMeApp.searchPageV2', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.controller('SearchPageV2Ctrl', ["$scope", "$location", "$http", "fmaLocalStorage", 'fmaSharedState', '$rootScope', '$timeout',
function($scope, $location, $http, fmaLocalStorage, fmaSharedState, $rootScope, $timeout) {
  var DEFAULT_ID = "-1";
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
  $scope.sortedMerchants.unshift({id: DEFAULT_ID, summary: { name: 'Not selected.' } });

  // Set the selected merchantId if we have one.
  var merchantIdIsMissing = _.every(
    $scope.globals.allMerchants,
    function(merchant) {
      return merchant.id != $scope.globals.selectedMerchantId;
    }
  );
  if ($scope.globals.selectedMerchantId == null || merchantIdIsMissing) {
    $scope.selectedMerchantId = DEFAULT_ID;
  } else {
    $scope.selectedMerchantId = $scope.globals.selectedMerchantId;
  }

  // Set the keyword if we have it.
  $scope.keywordValue = $scope.globals.keywordValue;

  // Set the delivery minimum limit if we have it.
  if ($scope.globals.deliveryMinimumLimit == null) {
    $scope.deliveryMinimumLimit = fmaSharedState.defaultDeliveryMinimumLimit;
  } else {
    $scope.deliveryMinimumLimit = $scope.globals.deliveryMinimumLimit;
  }

  $scope.selectDidChange = function() {
    // We have to clear the keyword. You can't do both at the same time.
    // TODO(daddy): Warn the user when clearing the keyword.
    $scope.keywordValue = '';
  };
  $scope.keywordDidChange = function() {
    // We have to clear the select. You can't do both at the same time.
    // TODO(daddy): Warn the user when clearing the select.
    $scope.selectedMerchantId = DEFAULT_ID;
  };
  $scope.addToLimit = function() {
    $scope.deliveryMinimumLimit++;
  };
  $scope.subtractFromLimit = function() {
    $scope.deliveryMinimumLimit--;
  };

  $scope.doneButtonPressed = function() {
    // Save our search variables and go back to the swipe page.
    $scope.globals.selectedMerchantId = $scope.selectedMerchantId;
    $scope.globals.keywordValue = $scope.keywordValue;
    $scope.globals.deliveryMinimumLimit = $scope.deliveryMinimumLimit;

    fmaLocalStorage.setObjectWithExpirationSeconds(
        'selectedMerchantId', $scope.globals.selectedMerchantId,
        fmaSharedState.foodItemValidationSeconds);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'deliveryMinimumLimit', $scope.globals.deliveryMinimumLimit,
        fmaSharedState.testing_invalidation_seconds);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'keywordValue', $scope.globals.keywordValue,
        fmaSharedState.foodItemValidationSeconds);
    $('.swipe_page__bottom_bar').animate({left: '33.33333%'});
    $location.path('/home_page_v2/swipe_page_v2');
    return;
  };
}]);
