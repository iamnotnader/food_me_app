/*jshint loopfunc: true, eqnull: true */

angular.module('foodMeApp.cartPage', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState', 'foodMeApp.stackHelper'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/cart_page', {
    templateUrl: 'cart_page/cart_page.html',
    controller: 'CartPageCtrl'
  });
}])

.controller('CartPageCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$q", "fmaStackHelper", "$timeout",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $q, fmaStackHelper, $timeout) {
  var mainViewObj = $('#main_view_container');

  // For the cart page, all we need is a token.
  console.log('In cart_page controller.');
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
  // At this point, we have a token.

  // Pull the cart items out of localStorage
  $scope.userCart = [];
  if (fmaLocalStorage.isSet('userCart')) {
    $scope.userCart = fmaLocalStorage.getObject('userCart');
  }

  // Finds the desiredItem inside menuObj and returns the menuObj version.
  // The menuObj version of the item will be more complete. Returns null if it
  // can't find it.
  //
  // TODO(daddy): We should be mindful of the schedule. If a restaurant only
  // serves our item during breakfast but it's dinner time, that's no good...
  var findMenuItemRecursive = function(menuObj, desiredItem) {
    if (menuObj.type === "item" && menuObj.id === desiredItem.navigation_id) {
      return menuObj;
    }
    // If we're here, menuObj is a menu, not an item.
    for (var menuIndex = 0; menuIndex < menuObj.children.length; menuIndex++) {
      var menuSubObj = menuObj.children[menuIndex];
      var desiredItemFound = findMenuItemRecursive(menuSubObj, desiredItem);
      if (desiredItemFound != null) {
        return desiredItemFound;
      }
    } 
    return null;
  };

  // Takes a cart item and finds the menu item that corresponds to it. The menu item has
  // more information than the cart item, which is why we need to get it.
  var findMenuItem = function(menuArr, cartItem) {
    // menuArr is a list of objects of type "menu." An  object of type "menu" has children
    // that are either of type "menu" OR of type "item." If they're of type "item," we want
    // to check to see if they match our cart item. If they're of type "menu," we want to
    // recurse on them.
    //
    // Because menuArr is not itself a menu, we cannot call findMenuItemRecursive on it directly.
    // That would have been nice because we would have had one line here.
    // Instead, we have to have this for loop here to pull out the actual menu objects and
    // call the function on them individually.
    var cartItemDetails = null;
    for (var menuIndex = 0; menuIndex < menuArr.length; menuIndex++) {
      var desiredItemFound = findMenuItemRecursive(menuArr[menuIndex], cartItem);
      if (desiredItemFound != null) {
        cartItemDetails = desiredItemFound;
        break;
      }
    }
    if (cartItemDetails == null) {
      console.warn("Could not find item in menu!");
      console.warn(cartItem);
      console.warn(menuArr);
    }
    return cartItemDetails;
  };

  $scope.removeFromCart = function(index) {
    console.log("Removing item " + index);
    $scope.userCart.splice(index, 1);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', $scope.userCart,
        fmaSharedState.testing_invalidation_seconds);
    // Remember itemDetailsFound is just a more detailed version of the userCart and
    // we keep both in sync.
    // Yes, I know this is shitty -- sue me.
    $scope.itemDetailsFound.splice(index, 1);
  };

  // ------------------------------------------------------------------------ //
  // TODO(daddy): Code between these dashes is toxic and should be moved and/or
  // removed.

  // TODO(daddy): I can hear this function softly crying "killll meeeeee!"
  var getOpenSchedules = function(scheduleArr) {
    currentDay = fmaSharedState.getDayAsString();
    if (scheduleArr != null && scheduleArr.length > 0) {
      var validSchedules = [];
      for (var scheduleI = 0; scheduleI < scheduleArr.length; scheduleI++) {
        var isValidSchedule = false;
        var currentSchedule = scheduleArr[scheduleI];
        for (var dayI = 0; dayI < currentSchedule.times.length; dayI++) {
          var scheduleDay = currentSchedule.times[dayI]; 
          if (scheduleDay.day === currentDay) {
            var from = new Date(scheduleDay.from);
            var to = new Date(scheduleDay.to);
            var now = new Date();
            if (now > from && now < to) {
              isValidSchedule = true;
              break;
            }
          }
        }
        if (isValidSchedule) {
          validSchedules.push(currentSchedule);
        }
      }
      return validSchedules;
    }
    return "all_valid";
  };

  var openMenus = function(menuArr, scheduleArr) {
    var openSchedules = getOpenSchedules(scheduleArr);
    if (openSchedules === "all_valid") {
      return menuArr;
    }

    if (openSchedules == null || openSchedules.length === 0) {
      return [];
    }

    var validMenus = [];
    for (var v1 = 0; v1 < menuArr.length; v1++) {
      var currentMenu = menuArr[v1];
      var currentSchedules = currentMenu.schedule;
      if (currentSchedules == null || currentSchedules.length === 0) {
        continue;
      }
      var schedulesOverlap = false;
      for (var v2 = 0; v2 < currentSchedules.length; v2++) {
        for (var v3 = 0; v3 < openSchedules.length; v3++) {
          if (currentSchedules[v2] === openSchedules[v3].id) {
            schedulesOverlap = true;
            break;
          }
        }
      }
      if (schedulesOverlap) {
        validMenus.push(currentMenu);
      }
    }
    return validMenus;
  };

  // -------------------------------------------------------------------------//
  // ------------------------------------------------------------------------ //

  var setCartTotal = function() {
    var total = 0.0;
    for (var v1 = 0; v1 < $scope.userCart.length; v1++) {
      total += parseFloat($scope.userCart[v1].price);
    }
    $scope.cartTotal = total.toFixed(2);
  };

  setCartTotal();
  $scope.$watch(
    function(scope) {
      // We only watch the cart length for efficiency reaasons.
      return scope.userCart.length;
    },
    function() {
      setCartTotal();
  });

  if ($scope.userCart.length > 0) {
    // Run the heavy stuff after the view has rendered.
    $scope.isLoading = true;
    $scope.cartItemsNotFound = [];
    $scope.itemDetailsFound = [];
    var loadStartTime = (new Date()).getTime();
    $scope.isLoading = true;
    $timeout(function() {
      for (var x = 0; x < $scope.userCart.length; x++) {
        (function(cartIndex) {
          var cartItem = $scope.userCart[cartIndex];
          $http.get(fmaSharedState.endpoint+'/merchant/'+cartItem.merchantId+'/menu?client_id=' + fmaSharedState.client_id)
          .then(
            function(res) {
              var menuArr = res.data.menu;
              // TODO(daddy): Culling down the menus like this is necessary for
              // now, but in the long run the food should be culled down before
              // the swipe page.
              menuArr = openMenus(menuArr, res.data.schedule);
              cartItemDetails = findMenuItem(menuArr, cartItem);
              if (cartItemDetails == null) {
                // This isn't used right now other than for its length property below.
                $scope.cartItemsNotFound.push(cartItem);
              } else {
                $scope.itemDetailsFound.push({
                  cart_item: cartItem,
                  item_details: cartItemDetails,
                });
              }
              if ($scope.cartItemsNotFound.length +
                  $scope.itemDetailsFound.length == $scope.userCart.length) {
                if ($scope.cartItemsNotFound.length > 0) {
                  alert("Doh! Some of the items in your cart were actually unavailable " +
                        "when we checked  the merchant's menu. This can happen occasionally " +
                        "but will be fixed in the next release. You can get around it for now by swiping " +
                        "right on more than one thing before heading to your cart. Fun fact: food is " +
                        "polygamous.");
                }
                // Sync the userCart with the itemDetailsFound. This is a little sneaky
                // because it will surreptitiously drop items that we didn't find above.
                // Note that the userCart is basically a shittier version of itemDetailsFound
                // at this point. We keep the two in sync but the itemDetailsFound is really
                // a strictly more detailed version of the userCart.
                $scope.userCart = [];
                for (var v1 = 0; v1 < $scope.itemDetailsFound.length; v1++) {
                  $scope.userCart.push($scope.itemDetailsFound[v1].cart_item);
                }
                // Save the userCart, since now we know it has good items in it.
                fmaLocalStorage.setObjectWithExpirationSeconds(
                    'userCart', $scope.userCart,
                    fmaSharedState.testing_invalidation_seconds);

                console.log('Done!');
                // Make the loading last at least a second.
                var timePassedMs = (new Date()).getTime() - loadStartTime;
                $timeout(function() {
                  $scope.isLoading = false;
                }, Math.max(fmaSharedState.minLoadingMs - timePassedMs, 0));
              }
            },
            function(err) {
              // Messed up response???
              console.warn("Problem getting menu.");
              $scope.cartItemsNotFound.push(cartItem);
            });
        })(x);
      }
    }, 0);
  }

  // A little more setup.
  $scope.cartBackButtonPressed = function() {
    console.log('Cart back button pressed.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/swipe_page');
  };

  $scope.cartFinishButtonPressed = function() {
    if ($scope.userCart.length === 0) {
      alert('Bro, you need SOMETHING in your cart first. ' +
            'Go back and swipe-- the food loves you.');
      return;
    }
    // Cull down $scope.itemRequestObjects to get it in line with cartItems.
    // Save cartItems
    // Save itemRequestObjects
    console.log('Finish button pressed.');
    // First thing's first. Save the cart.
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', $scope.userCart,
        fmaSharedState.testing_invalidation_seconds);

    // Here is where we finally actually save itemDetailsFound. We will use
    // it in the cards page to actually update the delivery.com cart.
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'itemDetailsFound', $scope.itemDetailsFound,
        fmaSharedState.testing_invalidation_seconds);

    console.log('Back button pressed.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-left');
    $location.path('/choose_card');
  };

  $scope.cartPageClearCartPressed = function() {
    console.log('Clear cart pressed.');
    $scope.userCart = [];
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', [],
        fmaSharedState.testing_invalidation_seconds);
    // Remember itemDetailsFound is just a more detailed version of the userCart and
    // we keep both in sync.
    // Yes, I know this is shitty -- sue me.
    $scope.itemDetailsFound.splice(index, 1);
  };
  
}]);
