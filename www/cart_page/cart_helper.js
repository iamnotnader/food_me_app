angular.module('foodmeApp.cartHelper', [])

// Just holds some global configuration variables that we can set to whatever
// we need.
.factory('fmaCartHelper', ["fmaSharedState", "$q", "$http", function(fmaSharedState, $q, $http) {
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
      if (requiredOG.type === "price group") {
        optionsToReturn.push(requiredOG.children[0]);
        continue;
      }
      var free_options = [];
      for (var v2 =  0; v2 < requiredOG.children.length; v2++) {
        var potentialFreeOption = requiredOG.children[v2];
        if (potentialFreeOption.price === 0) {
          free_options.push(potentialFreeOption);
        }        
      }
      if (free_options.length === 0) {
        analytics.trackEvent('error', 'cart_helper__no_free_options');
        alert('Something went haywire with the options on this order. ' +
              'Probably best if you just remove everything from your cart and ' +
              'pick something else. This is rare I promise and we are working to fix it!');
        console.warn('Required option had zero free options!');
        console.warn(singleItem);
        return optionsToReturn;
      }
      var numOptionsNeeded = requiredOG.min_selection;
      while (numOptionsNeeded > 0) {
        var randomFreeItemIndex = Math.floor(Math.random() * free_options.length);
        var chosenOption = free_options[randomFreeItemIndex];
        optionsToReturn.push(chosenOption);
        if (chosenOption.children.length > 0) {
          // This is weird to me but options can have their own option groups, so
          // we have to recurse on the option's children to add more possible
          // options.
          console.log("Recurring.");
          var optionsForOption = getOptionsForItem(chosenOption);
          optionsToReturn = optionsToReturn.concat(optionsForOption);
        }
        numOptionsNeeded--;
      }
    }
    //console.log(singleItem);
    //console.log(optionsToReturn);
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
  var createCartRequestsFromItems = function(cartItems) {
    // One request object for each thing in cartItems.
    var finalItemRequestObjects = [];
    for (var v1 = 0; v1 < cartItems.length; v1++) {
      var currentItem = cartItems[v1];
      var optionsForItem = getOptionsForItem(currentItem);
      // Add the selected options to the currentItem for fun.
      currentItem.selectedOptions = optionsForItem;

      // Create the actual request object.
      var optionRequestObject = constructRequestFromOptions(optionsForItem);
      var itemRequestObject = {
        item_id: currentItem.id,
        item_qty: 1,
        instructions: fmaSharedState.instructions,
        option_qty: optionRequestObject,
      };
      var finalRequestObject = {
        order_type: "delivery",
        client_id: fmaSharedState.client_id,
        item: itemRequestObject,
        order_time: (new Date()).toISOString(),
      };
      // Add the request object to our list.
      finalItemRequestObjects.push(finalRequestObject);
    }
    return finalItemRequestObjects;
  };

  var clearCartsPromise = function(cartItems, rawAccessToken) {
    return $q(function(resolve, reject) {
      var successfulPromisesReturned = 0;
      var failedPromisesReturned = 0;
      for (var v1 = 0; v1 < cartItems.length; v1++) {
        $http({
          method: 'DELETE',
          url: fmaSharedState.endpoint+'/customer/cart/'+cartItems[v1].merchantId+'?client_id=' + fmaSharedState.client_id,
          data: {current_index: 0},
          headers: {
            "Authorization": rawAccessToken,
            "Content-Type": "application/json",
          }
        }).then(
          function(res) {
            successfulPromisesReturned++;
            if (successfulPromisesReturned +
                failedPromisesReturned === cartItems.length) {
              resolve();
            }
          },
          function(err) {
            console.log(err);
            failedPromisesReturned++;
            if (successfulPromisesReturned +
                failedPromisesReturned === cartItems.length) {
              resolve();
            }
          }
        );
      }
    });
  };

  // TODO(daddy): FUCK YOU DELIVERY.COM! There is a race condition in your server
  // because you don't add items to the cart in a transaction. You need to do
  // the following:
  //   TRANSACTION { <--- NECESSARY
  //     - get the list of items currently in the cart from the db
  //     - add the current item to the cart
  //     - insert the new list of items back into the db
  //   }
  // Because you don't wrap this logic in a transaction and because you don't have
  // an endpoint to add a list of items, I have to add all of the items sequentially
  // or else risk having a half-empty cart. 
  var addCartItemsSequentiallyPromise = function(cartItems, itemRequestObjects,
      rawAccessToken, cartItemsAdded, cartItemsNotAdded, merchantId, currentItemIndex) {
    return $q(function(resolve, reject) {
      if (cartItems.length === currentItemIndex) {
        resolve({added: cartItemsAdded, not_added: cartItemsNotAdded});
        return;
      }

      var currentCartItem = cartItems[currentItemIndex];
      var currentItemRequestObject = itemRequestObjects[currentItemIndex];
      if (merchantId != null && merchantId !== currentCartItem.merchantId) {
        // Skip this item if we specify a merchantId that it doesn't match up
        // with.
        return addCartItemsSequentiallyPromise(cartItems, itemRequestObjects,
            rawAccessToken, cartItemsAdded, cartItemsNotAdded, merchantId,
            currentItemIndex + 1)
        .then(
          function(res) {
            resolve({added: cartItemsAdded, not_added: cartItemsNotAdded});
          },
          function(err) {
            reject({added: cartItemsAdded, not_added: cartItemsNotAdded});
          }
        );
      }
      console.log('Adding: ' + currentItemIndex);
      console.log(currentCartItem);
      // Add all items to the user's delivery.com cart.
      $http({
        method: 'POST',
        url: fmaSharedState.endpoint+'/customer/cart/'+currentCartItem.merchantId+'?client_id=' + fmaSharedState.client_id,
        data: currentItemRequestObject,
        headers: {
          "Authorization": rawAccessToken,
          "Content-Type": "application/json",
        }
      }).then(
        function(res) {
          cartItemsAdded.push(currentCartItem);
          addCartItemsSequentiallyPromise(cartItems, itemRequestObjects,
              rawAccessToken, cartItemsAdded, cartItemsNotAdded, merchantId,
              currentItemIndex + 1)
          .then(
            function(res) {
              resolve({added: cartItemsAdded, not_added: cartItemsNotAdded});
            },
            function(err) {
              reject({added: cartItemsAdded, not_added: cartItemsNotAdded});
            }
          );
        },
        function(err) {
          cartItemsNotAdded.push(currentCartItem);
          // In this case, we always reject regardless of what subsequent calls
          // return.
          addCartItemsSequentiallyPromise(cartItems, itemRequestObjects,
              rawAccessToken, cartItemsAdded, cartItemsNotAdded, merchantId,
              currentItemIndex + 1)
          .then(
            function(res) {
              reject({added: cartItemsAdded, not_added: cartItemsNotAdded});
            },
            function(err) {
              reject({added: cartItemsAdded, not_added: cartItemsNotAdded});
            }
          );
        }
      );
    });
  };

  var addCartsPromise = function(cartItems, itemRequestObjects, rawAccessToken, merchantId) {
    var cartItemsAdded = [];
    var cartItemsNotAdded = [];
    return addCartItemsSequentiallyPromise(cartItems, itemRequestObjects,
        rawAccessToken, cartItemsAdded, cartItemsNotAdded, merchantId, 0);
  };

  // If merchantId is null, add all the items.
  var clearCartThenUpdateCartPromise = function(cartItems, rawAccessToken, merchantId) {
    return $q(function(resolve, reject) {
      // Actual init.
      itemRequestObjects = createCartRequestsFromItems(cartItems);
      // Clear the user's cart.
      clearCartsPromise(cartItems, rawAccessToken)
      .then(
        // At this point the cart should be cleared.
        function(res) {
          addCartsPromise(cartItems, itemRequestObjects, rawAccessToken, merchantId)
          .then(
            function(res) {
              // Cleared the cart and refreshed it with all our new items
              // YAY!
              resolve(res);
            },
            function(err) {
              reject(err);
            }
          );
        },
        function(err) {
          // We can't ever get here because clearCartsPromise always resolves.
          reject(err);
        }
      );
    });
  };

  return {
    clearCartThenUpdateCartPromise: clearCartThenUpdateCartPromise,
  };
}]);
