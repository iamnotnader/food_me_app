/* jshint eqnull: true */

angular.module('foodMeApp.chooseCuisine', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/choose_cuisine', {
    templateUrl: 'choose_cuisine/choose_cuisine.html',
    controller: 'ChooseCuisineCtrl'
  });
}])

.controller('ChooseCuisineCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$rootScope", "$timeout",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $rootScope, $timeout) {
  var mainViewObj = $('#main_view_container');

  // For this controller, we need a token and an address. If we are missing
  // either one of those, we redirect to another screen in order to get it.
  console.log('In choose_cuisine controller.');
  $scope.userToken = fmaLocalStorage.getObject('userToken');
  $scope.rawAccessToken = null;
  if (fmaSharedState.fake_token) {
    alert('Warning-- you are using a fake access token.');
    console.log('Fake token being used.');
    $scope.rawAccessToken = fmaSharedState.fake_token;
  } else if (_.has($scope.userToken, 'access_token')) {
    console.log('Stored token being used.');
    $scope.rawAccessToken = $scope.userToken.access_token;
  }
  if ($scope.rawAccessToken === null) {
    analytics.trackEvent('reroute', 'choose_cuisine__intro_screen');

    alert('In order to set cuisines, we need you to log in first.');
    console.log('No token found-- go back to intro_screen.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/intro_screen');
    return;
  }
  if (!fmaLocalStorage.isSet('userAddress')) {
    analytics.trackEvent('reroute', 'choose_cuisine__choose_address_v2');

    alert("In order to set cuisines, we need an address first. Please enter one.");
    console.log('No address found-- go back to choose_address_v2 to get it.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/choose_address_v2');
    return;
  }
  $scope.userAddress = fmaLocalStorage.getObject('userAddress');
  // When we get here, we have a valid user token and a valid address.

  analytics.trackView('/choose_cuisine');

  // The location the user wants to use when looking for restaurants. This is an
  // object so we can use it in ng-repeat without scope issues.
  $scope.selectedCuisineIndices = { value: [] };
  $scope.isSelected = function(index) {
    return $scope.selectedCuisineIndices.value.indexOf(index) != -1;
  };

  // The button at the top lets you select all. We default it to having selected
  // everything by toggling once.
  $scope.selectAllButtonSet = true;
  $scope.toggleSelectAll = function() {
    $scope.selectAllButtonSet = !$scope.selectAllButtonSet;
    if ($scope.selectAllButtonSet) {
      analytics.trackEvent('cell', 'choose_cuisine__select_all_off');

      $scope.selectAllText = "select all types";
      $scope.selectedCuisineIndices = { value: [] };
    } else {
      analytics.trackEvent('cell', 'choose_cuisine__select_all_on');

      $scope.selectAllText = "deselect all types";
      $scope.selectedCuisineIndices = { value: _.range(fmaSharedState.numCuisinesToShow) };
    }
  };
  $scope.toggleSelectAll();

  $scope.isLoading = true;
  var loadStartTime = (new Date()).getTime();
  console.log(JSON.stringify($scope.userAddress));
  $http.defaults.headers.common.Authorization = $scope.rawAccessToken;
  $http.get(fmaSharedState.endpoint+'/merchant/search/delivery?' + 
            'client_id=' + fmaSharedState.client_id + '&' +
            'latitude=' + $scope.userAddress.latitude + '&' +
            'longitude=' + $scope.userAddress.longitude + '&' +
            'merchant_type=R&' +
            'access_token=' + $scope.rawAccessToken
  )
  .then(
  function(res) {
    // We only want cuisines from places that are open right now.
    var cuisinesByCount = {};
    var merchants = res.data.merchants;
    for (var v1 = 0; v1 < merchants.length; v1++) {
      var currentMerchant = merchants[v1];
      if (currentMerchant.ordering != null && currentMerchant.ordering.is_open) {
        if (currentMerchant.summary.cuisines == null) {
          continue;
        }
        var merchantCuisines = currentMerchant.summary.cuisines;        
        for (var v2 = 0; v2 < merchantCuisines.length; v2++) {
          var currentCuisine = merchantCuisines[v2];
          if (cuisinesByCount[currentCuisine] == null) {
            cuisinesByCount[currentCuisine] = 0;
            continue;
          }
          cuisinesByCount[currentCuisine]++;
        }
      }
    }
    // Convert the cuisinesByCount into an array of counts.
    $scope.all_cuisines = [];
    for (var cuisineName in cuisinesByCount) {
      $scope.all_cuisines.push({
        name: cuisineName,
        count: cuisinesByCount[cuisineName]
      });
    }

    // Sort and set the cuisines.
    $scope.all_cuisines.sort(function(a, b) {
      return b.count - a.count;
    });
    fmaLocalStorage.setObject('userCuisines', {});
    $scope.all_cuisines = $scope.all_cuisines.slice(0, fmaSharedState.numCuisinesToShow);
    // Note that we need to set it on our res because we then store
    // res.data.
    res.data.cuisines = $scope.all_cuisines;
    $scope.selectedCuisineIndices = { value: _.range(fmaSharedState.numCuisinesToShow) };

    // Set the merchant data and reinitialize the chosen cuisines.
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'allNearbyMerchantData', res.data,
        fmaSharedState.testing_invalidation_seconds);
    // Make the loading last at least a second.
    var timePassedMs = (new Date()).getTime() - loadStartTime;
    analytics.trackTiming('loading', timePassedMs, 'choose_cuisine_success');
    $timeout(function() {
      $scope.isLoading = false;
    }, Math.max(fmaSharedState.minLoadingMs - timePassedMs, 0));
  },
  function(err) {
    // Log this error with google analytics.
    var timePassedMs = (new Date()).getTime() - loadStartTime;
    analytics.trackTiming('loading', timePassedMs, 'choose_cuisine_error');

    console.log('Error occurred.');
    console.log(JSON.stringify(err));
    $scope.isLoading = false;
  });

  $scope.chooseCuisineBackPressed = function() {
    analytics.trackEvent('nav', 'choose_cuisine__back_pressed');

    console.log('Back button pressed.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('choose_address_v2');
    return;
  };

  // Set the selected location index when a user taps a cell.
  $scope.cellTapped = function(indexTapped) {
    analytics.trackEvent('cell', 'choose_cuisine__cell_selected');

    console.log('Cell tapped: ' + indexTapped);
    var chosenIndices = $scope.selectedCuisineIndices.value;
    if (chosenIndices.indexOf(indexTapped) != -1) {
      $scope.selectedCuisineIndices.value = _.without(chosenIndices, indexTapped);
      return;
    }
    chosenIndices.push(indexTapped);
  };
  
  $scope.chooseCuisineDonePressed = function() {
    analytics.trackEvent('nav', 'choose_cuisine__done_pressed');

    console.log('Done button pressed.');
    if ($scope.selectedCuisineIndices.value.length <= 0) {
      console.log('No cuisines selected.');
      alert('You must select at least one cuisine.');
      return;
    }
    var cuisineIndices = $scope.selectedCuisineIndices.value;
    var userCuisines = [];
    for (var x = 0; x < cuisineIndices.length; x++) {
      // Just in case-- check to make sure we're not out of bounds.
      var currentIndex = cuisineIndices[x];
      if (currentIndex < $scope.all_cuisines.length) {
        userCuisines.push($scope.all_cuisines[cuisineIndices[x]]);
      }
    }
    // These correspond directly to values in allNearbyMerchantData.cuisines.
    console.log(userCuisines);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCuisines', userCuisines,
        fmaSharedState.testing_invalidation_seconds);
    // Clear the stack.
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'foodData', null,
        fmaSharedState.testing_invalidation_seconds);
    
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-left');
    $location.path('/swipe_page');
    return;
  };

}]);
