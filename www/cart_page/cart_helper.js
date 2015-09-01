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

  var addCartsPromise = function(cartItems, itemRequestObjects, rawAccessToken) {
    return $q(function(resolve, reject) {
      var cartItemsAdded = [];
      var cartItemsNotAdded = [];
      for (var v1 = 0; v1 < cartItems.length; v1++) {
        (function (x1) {
          var currentCartItem = cartItems[x1];
          // Add all items to the user's delivery.com cart.
          $http({
            method: 'POST',
            url: fmaSharedState.endpoint+'/customer/cart/'+currentCartItem.merchantId+'?client_id=' + fmaSharedState.client_id,
            data: itemRequestObjects[x1],
            headers: {
              "Authorization": rawAccessToken,
              "Content-Type": "application/json",
            }
          }).then(
            function(res) {
              cartItemsAdded.push(currentCartItem);
              if (cartItemsAdded.length +
                  cartItemsNotAdded.length === cartItems.length) {
                if (cartItemsNotAdded.length > 0) {
                  reject({added: cartItemsAdded, not_added: cartItemsNotAdded});
                }
                resolve({added: cartItemsAdded, not_added: []});
              }
            },
            function(err) {
              cartItemsNotAdded.push(currentCartItem);
              if (cartItemsAdded.length +
                  cartItemsNotAdded.length === cartItems.length) {
                if (cartItemsNotAdded.length > 0) {
                  reject({added: cartItemsAdded, not_added: cartItemsNotAdded});
                }
                resolve({added: cartItemsAdded, not_added: []});
              }
            }
          );
        })(v1);
      }
    });
  };

  var clearCartThenUpdateCartPromise = function(cartItems, rawAccessToken) {
    return $q(function(resolve, reject) {
      // Actual init.
      itemRequestObjects = createCartRequestsFromItems(cartItems);
      // Clear the user's cart.
      clearCartsPromise(cartItems, rawAccessToken)
      .then(
        // At this point the cart should be cleared.
        function(res) {
          addCartsPromise(cartItems, itemRequestObjects, rawAccessToken)
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
