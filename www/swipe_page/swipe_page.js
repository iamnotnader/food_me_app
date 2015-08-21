angular.module('foodMeApp.swipePage', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState', 'foodMeApp.stackHelper'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/swipe_page', {
    templateUrl: 'swipe_page/swipe_page.html',
    controller: 'SwipePageCtrl'
  });
}])

.controller('SwipePageCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$q", "fmaStackHelper", "$timeout",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $q, fmaStackHelper, $timeout) {
  // For this page, we need a token, an address, and some chosen cuisines. If we
  // are missing any of these, then we redirect to the proper page to get them.
  console.log('In swipe_page controller.');
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
    alert('In order to swipe, we need you to log in first.');
    console.log('No token found-- go back to intro_screen.');
    $location.path('/intro_screen');
    return;
  }
  if (!fmaLocalStorage.isSet('userAddress')) {
    alert("In order to swipe, we need an address and some cuisines first.");
    console.log('No address found-- go back to choose_address to get it.');
    $location.path('/choose_address');
    return;
  }
  if (!fmaLocalStorage.isSet('userCuisines')) {
    alert("In order to swipe, we need some cuisines first.");
    console.log('No cuisines. Go back to choose_cuisine.');
    $location.path('/choose_cuisine');
    return;
  }
  $scope.userAddress = fmaLocalStorage.getObject('userAddress');
  $scope.userCuisines = fmaLocalStorage.getObject('userCuisines');
  // If we get here, we have a token, an address, and some chosen cuisines.

  // foodData is like a lot of food objects. Like > 100. But the stack consists
  // of fewer-- a max of $scope.numPicsInStack to be exact. In order to avoid
  // refetching foodData every time we want to refresh the stack, we keep an
  // index into the gigantic foodData array. That index is $scope.foodDataCursor.
  $scope.foodDataCursor = 0;
  $scope.numPicsInStack = 3;
  $scope.showFoodInfo = true;
  $scope.maybeRefreshStack = function() {
    console.log("Checking refresh: " + $scope.foodDataCursor);
    if ($scope.foodDataCursor % $scope.numPicsInStack !== 0) {
      return;
    }
    $scope.showFoodInfo = false;
    numPicsToFetch = Math.min(
        $scope.numPicsInStack, $scope.foodData.length - $scope.foodDataCursor);
    fmaStackHelper.asyncGetFoodImageLinks($scope.foodData, $scope.foodDataCursor, numPicsToFetch)
    .then(
      function(retVars) {
        $scope.foodImageLinks = retVars.foodImageLinks;
        computeJoinedFoodDataImageList($scope.foodDataCursor);
        $scope.showFoodInfo = true;
      },
      function(err) {
    });
  };
  $scope.userLikedDish = function(item) {
    $scope.$apply(function() {
      console.log('liked!');
      $scope.foodDataCursor++;
      $scope.maybeRefreshStack();
      // TODO(daddy): Make it so the dish is added to the user's cart in this case.
    });
  };
  $scope.userDislikedDish = function(item) {
    $scope.$apply(function() {
      console.log('disliked!');
      $scope.foodDataCursor++;
      $scope.maybeRefreshStack();
      // TODO(daddy): Make it so the dish is added to history or something.
    });
  };

  // By the time we reach this function, we are guaranteed to haeve set:
  //  - $scope.allNearbyMerchantData
  //  - $scope.foodData
  //  - $scope.foodImageLinks
  //
  // Furthermore, foodImageLinks will be shorter than foodData, because we only
  // fetch a maximum of 10 sets of images. We do some joining in this function
  // to make it easier to display the results.
  //
  // foodDataCursor is the index into foodData where our images start. The stack
  // and all the images in imageData represent the food in
  //   - foodData[foodDataCursor:foodDataCursor + $scope.foodImageLinks.length]
  var computeJoinedFoodDataImageList = function(foodDataCursor) {
    console.log('Yay joining foodData and imageLinks!');
    $scope.joinedFoodInfo = [];
    // Note that foodImageLinks always has fewer items than foodData because we
    // populate it conservatively.
    for (var x = 0; x < $scope.foodImageLinks.length; x++) {
      $scope.joinedFoodInfo.push({
        foodData: $scope.foodData[foodDataCursor + x],
        imageLinks: $scope.foodImageLinks[x],
      });
    }
    console.log($scope.joinedFoodInfo);

    // TODO(daddy): THIS IS A DIRTY_HACK!!!
    $timeout(function() {
      console.log('Loaded jTinder');
      $("#tinderslide").jTinder({
          onDislike: $scope.userDislikedDish,
          onLike: $scope.userLikedDish,
          animationRevertSpeed: 200,
          animationSpeed: 400,
          threshold: 1,
          likeSelector: '.like',
          dislikeSelector: '.dislike'
      });
    }, 0);
  };

  // After loading all the data variables, we do some more setup.
  $scope.isLoading = true;
  fmaStackHelper.setUpDataVariables(
      $scope.userAddress.latitude, $scope.userAddress.longitude,
      $scope.rawAccessToken, $scope.userCuisines, $scope.numPicsInStack, false).then(
    function(retVars) {
      $scope.allNearbyMerchantData = retVars.allNearbyMerchantData;
      $scope.foodData = retVars.foodData;
      $scope.foodImageLinks = retVars.foodImageLinks;

      console.log('Final setup.');
      computeJoinedFoodDataImageList($scope.foodDataCursor);
      
      $scope.isLoading = false;
    },
    function(err) {
      // Not really sure what to do here.
    } 
  );
}])

.directive('fmaBackImg', function(){
    return function(scope, element, attrs){
        var url = attrs.fmaBackImg;
        element.css({
            'background-image': 'url(' + url +')',
            'background-size' : 'cover'
        });
    };
});
