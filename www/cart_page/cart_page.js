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
    } else {
      console.log("We found the money!");
    }
    return cartItemDetails;
  };

  // Remove all the cart items that we couldn't get menu information for.
  // This is a little sneaky in the sense that the user will have added something
  // to the cart and then not see it ever again.
  var removeMissingCartItemsAndSave = function(userCart, cartItemsNotFound) {
    var userCartRet = _.reject(userCart, function(itemBeingChecked) {
      for (var notFoundIndex = 0; notFoundIndex < cartItemsNotFound.length;
            notFoundIndex++) {
        var itemNotFound = cartItemsNotFound[notFoundIndex];
        if (itemNotFound === itemBeingChecked) {
          return true;
        }
      }
      return false;
    });

    // Save the userCart, since now we know it has good items in it.
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', userCartRet,
        fmaSharedState.testing_invalidation_seconds);
    return userCartRet;
  };

  var getOptionsForItem = function(singleItem) {
    console.log('Getting options');
    var optionsToReturn = [];
    var requiredOptionGroups = [];
    for (var v1 = 0; v1 < singleItem.children.length; v1++) {
      // Find the option groups with min_selection > 0.
      var currentChild = singleItem.children[v1];
      if (currentChild.min_selection > 0) {
        requiredOptionGroups.push(currentChild);
      }
    }

    for (v1 = 0; v1 < requiredOptionGroups.length; v1++) {
      // We shuffle the options, then sort them by price and pick the first ones
      // until we have enough to satisfy min_selection. Works because sort is
      // stable.
      var requiredOG = requiredOptionGroups[v1];
      requiredOG.children = _.shuffle(requiredOG.children);
      requiredOG.children.sort(function(option1, option2) {
        return option1.price - option2.price;
      });
      for (v2 = 0; v2 < requiredOG.min_selection; v2++) {
        var chosenOption = requiredOG.children[v2];
        optionsToReturn.push(chosenOption);
        if (chosenOption.children.length > 0) {
          // This is weird to me but options can have their own option groups, so
          // we have to recurse on the option's children to add more possible
          // options.
          console.log("Recurring.");
          var optionsForOption = getOptionsForItem(chosenOption);          
          optionsToReturn = optionsToReturn.concat(optionsForOption);
        }
      }
    }
    return optionsToReturn;
  };

  var constructRequestFromOptions = function(optionsForItem) {
    requestObj = {};
    for (var v1 = 0; v1 < optionsForItem.length; v1++) {
      var currentOption = optionsForItem[v1];
      var amount = 1;
      if (currentOption.increment != null) {
        amount = currentOption.increment;
      }
      // Set the minimum amount necessary to make this order work.
      requestObj[currentOption.id] = amount;
    }
    return requestObj;
  };

  // Takes all of the menu items (cartItemsFound), looks at their options, and
  // constructs "proper" Item objects that we can then pass to the delivery.com
  // cart API.
  //
  // https://developers.delivery.com/customer-cart/#item-object
  var createRequestsFromItems = function(cartItemsFound) {
    // One request object for each thing in cartItemsFound.
    var finalItemRequestObjects = [];
    for (var v1 = 0; v1 < cartItemsFound.length; v1++) {
      var currentItem = cartItemsFound[v1];
      var optionsForItem = getOptionsForItem(currentItem);
      // Add the selected options to the currentItem for fun.
      currentItem.selectedOptions = optionsForItem;

      // Create the actual request object.
      var optionRequestObject = constructRequestFromOptions(optionsForItem);
      var itemRequestObject = {
        item_id: currentItem.navigation_id,
        item_qty: 1,
        // TODO(daddy): Make it so user can add instructions.
        instructions: "",
        option_qty: optionRequestObject,
      };
      var finalRequestObject = {
        order_type: "delivery",
        client_id: fmaSharedState.client_id,
        item: itemRequestObject,
      };
      // Add the request object to our list.
      finalItemRequestObjects.push(finalRequestObject);
    }
    return finalItemRequestObjects;
  };

  $scope.removeFromCart = function(index) {
    console.log("Removing item " + index);
    // If we're using a fake token, we don't confirm.
    $scope.userCart.splice(index, 1);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', $scope.userCart,
        fmaSharedState.testing_invalidation_seconds);
  };

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
    $scope.cartItemsFound = [];
    $scope.isLoading = true;
    $scope.cartItemsNotFound = [];
    var loadStartTime = (new Date()).getTime();
    $scope.isLoading = true;
    $timeout(function() {
      for (var x = 0; x < $scope.userCart.length; x++) {
        (function(cartIndex) {
          var cartItem = $scope.userCart[cartIndex];
          $http.get('https://api.delivery.com/merchant/'+cartItem.merchantId+'/menu?client_id=' + fmaSharedState.client_id)
          .then(
            function(res) {
              var menuArr = res.data.menu;
              cartItemDetails = findMenuItem(menuArr, cartItem);
              if (cartItemDetails == null) {
                $scope.cartItemsNotFound.push(cartItem);
              } else {
                $scope.cartItemsFound.push(cartItemDetails);
              }
              if ($scope.cartItemsNotFound.length +
                  $scope.cartItemsFound.length == $scope.userCart.length) {
                // Now we've attempted to load all the items. Set the options for
                // all the ones we got back and remove all the ones we couldn't
                // load from the cart surreptitiously...
                $scope.userCart = removeMissingCartItemsAndSave($scope.userCart, $scope.cartItemsNotFound);

                // At this point, userCart should have the same items as cartItemsFound, but
                // with cartItemsFound having more information.
                $scope.itemRequestObjects = createRequestsFromItems($scope.cartItemsFound);
                console.log($scope.userCart);
                console.log($scope.itemRequestObjects);
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

  $scope.cartPageClearCartPressed = function() {
    console.log('Clear cart pressed.');
    $scope.userCart = [];
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', [],
        fmaSharedState.testing_invalidation_seconds);
  };
  
}]);
