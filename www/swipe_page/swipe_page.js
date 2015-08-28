angular.module('foodMeApp.swipePage', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState', 'foodMeApp.stackHelper'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/swipe_page', {
    templateUrl: 'swipe_page/swipe_page.html',
    controller: 'SwipePageCtrl'
  });
}])

.controller('SwipePageCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$q", "fmaStackHelper", "$timeout",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $q, fmaStackHelper, $timeout) {
  // We attach classes to this to make transitions smooth.
  var mainViewObj = $('#main_view_container');

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

  // The items in the user's cart.
  $scope.showCartBadge = false;
  $scope.userCart = [];
  if (fmaLocalStorage.isSet('userCart')) {
    $scope.userCart = fmaLocalStorage.getObject('userCart');
  }

  $scope.cartButtonPressed = function() {
    console.log('cart pressed!');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-left');
    $location.path('/cart_page');
  };

  $scope.settingsButtonPressed = function() {
    console.log('settings pressed!');
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', null,
        fmaSharedState.testing_invalidation_seconds);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userToken', null,
        fmaSharedState.testing_invalidation_seconds);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userAddress', null,
        fmaSharedState.testing_invalidation_seconds);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCuisines', null,
        fmaSharedState.testing_invalidation_seconds);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'foodData', null,
        fmaSharedState.testing_invalidation_seconds);
  };

  // foodData is like a lot of food objects. Like > 100. But the stack consists
  // of fewer-- a max of $scope.numPicsInStack to be exact. In order to avoid
  // refetching foodData every time we want to refresh the stack, we keep an
  // index into the gigantic foodData array. That index is $scope.foodDataCursor.
  $scope.foodDataCursor = 0;
  $scope.numPicsInStack = 3;
  $scope.numMerchantsToFetch = 10;
  $scope.showFoodInfo = true;
  $scope.maybeRefreshStack = function() {
    if ($scope.foodDataCursor % $scope.numPicsInStack !== 0) {
      return;
    }
    $scope.showFoodInfo = false;
    var foodFetchStartTime = (new Date()).getTime();
    numPicsToFetch = Math.min(
        $scope.numPicsInStack, $scope.foodData.length - $scope.foodDataCursor);
    fmaStackHelper.asyncGetFoodImageLinks($scope.foodData, $scope.foodDataCursor, numPicsToFetch)
    .then(
      function(retVars) {
        // Wait at least 150ms to bring the cards back.
        var timePassedMs = (new Date()).getTime() - foodFetchStartTime;
        $timeout(function() {
          $scope.foodImageLinks = retVars.foodImageLinks;
          computeJoinedFoodDataImageList($scope.foodDataCursor);
          $scope.showFoodInfo = true;
        }, Math.max(1000 - timePassedMs, 0));
      },
      function(err) {
    });
  };
  $scope.userLikedDish = function(item) {
    $scope.$apply(function() {
      console.log('liked!');
      // Add the swiped food to the cart and save the cart to localStorage.
      $scope.userCart.push($scope.foodData[$scope.foodDataCursor]);
      $scope.userCart = _.uniq($scope.userCart, function(item) {
        return item.unique_key;
      });
      fmaLocalStorage.setObjectWithExpirationSeconds(
          'userCart', $scope.userCart,
          fmaSharedState.testing_invalidation_seconds);

      // Update the food cursor and possibly refresh the stack.
      $scope.foodDataCursor++;
      $scope.maybeRefreshStack();
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

  var isBadDescription = function(description) {
    return description == null || description.length < 5;
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
    console.log('Joining foodData and imageLinks!');
    $scope.joinedFoodInfo = [];
    // Note that foodImageLinks always has fewer items than foodData because we
    // populate it conservatively.
    for (var x = 0; x < $scope.foodImageLinks.length; x++) {
      var foodDataObj = $scope.foodData[foodDataCursor + x];
      if (isBadDescription(foodDataObj.description) &&
          isBadDescription(foodDataObj.merchantDescription)) {
        foodDataObj.description = "No description available :(";
      }
      $scope.joinedFoodInfo.push({
        foodData: foodDataObj,
        imageLinks: $scope.foodImageLinks[x],
      });
    }
    // We need to reverse the list we show.
    $scope.joinedFoodInfo.reverse();

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
  // TODO(daddy): Evaluate the ramifications of making the last argument force=true.
  // so we never used cached food data.
  $scope.isLoading = true;
  fmaStackHelper.setUpDataVariables(
      $scope.userAddress.latitude, $scope.userAddress.longitude,
      $scope.rawAccessToken, $scope.userCuisines, $scope.numPicsInStack,
      $scope.numMerchantsToFetch, false).then(
    function(retVars) {
      $scope.allNearbyMerchantData = retVars.allNearbyMerchantData;
      $scope.foodData = retVars.foodData;
      $scope.foodImageLinks = retVars.foodImageLinks;

      $scope.isLoading = false;
      computeJoinedFoodDataImageList($scope.foodDataCursor);
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
})

// We position the badge with the number of items added to cart on
// loading the screen. It's hard to do otherwise.
// TODO(daddy): This is pretty shitty-- we actually use a timeout to wait
// for everything to load before we move the little badge.
.directive('swipePageCartImageOnLoad', ['$timeout', function($timeout) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            element.bind('load', function() {
              $timeout(function() {
                var cartWidth = element.width();
                var cartHeight = element.height();
                var cartLeftOffset = element.offset().left;
                var cartRightOffset = element.offset().top;
                var badge = $('.swipe_page__num_items_in_cart_badge');
                badge.css('top', cartRightOffset - badge.height()/2);
                badge.css('left', cartLeftOffset + cartWidth - badge.width()/2);
                scope.showCartBadge = true;
              }, 1000);
            });
        }
    };
}]);
