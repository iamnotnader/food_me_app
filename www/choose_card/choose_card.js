angular.module('foodMeApp.chooseCard', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/choose_card', {
    templateUrl: 'choose_card/choose_card.html',
    controller: 'ChooseCardCtrl'
  });
}])

.controller('ChooseCardCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$rootScope", "$timeout", "$q",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $rootScope, $timeout, $q) {
  var mainViewObj = $('#main_view_container');

  // On this screen, we need a valid user token. If we are missing one, we need
  // to go back to the intro_screen to get it.
  //
  // We also need a nonempty cart, but that should be naturally enforced by the
  // last page. Just in case, though...
  console.log('In choose_card controller.');
  $scope.userToken = fmaLocalStorage.getObject('userToken');
  $scope.rawAccessToken = null;
  if (fmaSharedState.fake_token) {
    alert('Warning-- you are using a fake access token.');
    console.log('Fake access token being used.');
    $scope.rawAccessToken = fmaSharedState.fake_token;
  } else if ($scope.userToken != null && _.has($scope.userToken, 'access_token')) {
    $scope.rawAccessToken = $scope.userToken.access_token;
  }
  if ($scope.rawAccessToken === null) {
    alert('In order to choose an address, we need you to log in first.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/intro_screen');
    return;
  }
  $scope.userCart = fmaLocalStorage.getObject('userCart');
  $scope.itemDetailsFound = fmaLocalStorage.getObject('itemDetailsFound');
  if ($scope.userCart == null || $scope.userCart.length === 0) {
    // We redirect to the cart page if the cart is empty.
    alert('We need something in your cart first.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/cart_page');
    return;
  }
  if ($scope.itemDetailsFound == null ||
      $scope.userCart.length !== $scope.itemDetailsFound.length) {
    alert('Something really weird happened-- tell me: 212-729-6389. ' +
          'Also give me this code: fucked_up_item_details');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/cart_page');
    return;
  }
  // If we get here, we have a valid user token AND userCart is nonempty AND
  // itemDetailsFound matches up with userCart. Woohoo!

//----------------------------------------------------------------------------------
//TODO(daddy): Either delete or use the code below.

  // Get the itemDetailsFound
  // Make sure it matches up exactly with the userCart (if they don't, reset both and return to the cart page or something.)
  // --
  // If they match, construct a request object for each item consisting of a link and an object
  // Clear the old cart
  // Send all the request objects
  // Check that it updated the cart on delivery.com
  // Get the credit cards
  // Make them pick one
  // Potentially add one
  // Send the transaction through.


  //$scope.selectedCardIndex = { value: null };

  //// Set the selected location index when a user taps a cell.
  //$scope.cellSelected = function(indexSelected) {
    //console.log('Cell selected: ' + indexSelected);
    //$scope.selectedLocationIndex.value = indexSelected;
  //};


  //$scope.cardList = [];

                //// At this point, userCart should have the same items as itemDetailsFound, but
                //// with itemDetailsFound having strictly more information per entry. They should
                //// also be in the same order.
                //$scope.itemRequestObjects = createRequestsFromItems($scope.itemDetailsFound);
                //console.log($scope.userCart);
                //console.log($scope.itemRequestObjects);

    //// At this point, userCart should have the same items as cartItemsFound, but
    //// with cartItemsFound having more information.
    //$scope.itemRequestObjects = createRequestsFromItems($scope.userCart);

//----------------------------------------------------------------------------------

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
  var createRequestsFromItems = function(itemDetails) {
    // One request object for each thing in itemDetails.
    var finalItemRequestObjects = [];
    for (var v1 = 0; v1 < itemDetails.length; v1++) {
      var currentItem = itemDetails[v1].item_details;
      var optionsForItem = getOptionsForItem(currentItem);
      // Add the selected options to the currentItem for fun.
      currentItem.selectedOptions = optionsForItem;

      // Create the actual request object.
      var optionRequestObject = constructRequestFromOptions(optionsForItem);
      var itemRequestObject = {
        item_id: currentItem.id,
        item_qty: 1,
        instructions: "Nader Al-Naji is GOD!",
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


  $scope.chooseCardBackPressed = function() {
    console.log('Back button pressed.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('cart_page');
    return;
  };

  var clearCartsPromise = function(itemDetails) {
    return $q(function(resolve, reject) {
      var successfulPromisesReturned = 0;
      var failedPromisesReturned = 0;
      for (var v1 = 0; v1 < itemDetails.length; v1++) {
        $http({
          method: 'DELETE',
          url: fmaSharedState.endpoint+'/customer/cart/'+itemDetails[v1].cart_item.merchantId+'?client_id=' + fmaSharedState.client_id,
          headers: {
            "Authorization": $scope.rawAccessToken,
            "Content-Type": "application/json",
          }
        }).then(
          function(res) {
            successfulPromisesReturned++;
            if (successfulPromisesReturned +
                failedPromisesReturned === itemDetails.length) {
              resolve();
            }
          },
          function(err) {
            console.log(err);
            failedPromisesReturned++;
            if (successfulPromisesReturned +
                failedPromisesReturned === itemDetails.length) {
              resolve();
            }
          }
        );
      }
    });
  }

  var addCartsPromise = function(itemDetails, itemRequestObjects) {
    return $q(function(resolve, reject) {
      var successfulPromisesReturned = 0;
      var failedPromisesReturned = 0;
      for (var v1 = 0; v1 < itemDetails.length; v1++) {
        (function (x1) {
          // Add all items to the user's delivery.com cart.
          $http({
            method: 'POST',
            url: fmaSharedState.endpoint+'/customer/cart/'+itemDetails[x1].cart_item.merchantId+'?client_id=' + fmaSharedState.client_id,
            data: $scope.itemRequestObjects[x1],
            headers: {
              "Authorization": $scope.rawAccessToken,
              "Content-Type": "application/json",
            }
          }).then(
            function(res) {
              successfulPromisesReturned++;
              if (successfulPromisesReturned +
                  failedPromisesReturned === itemDetails.length) {
                resolve();
              }
            },
            function(err) {
              alert("Doh! One of the items in your cart couldn't actually be " +
                    "bought. This should never happen-- call me: 212-729-6389.");
              console.log("One item couldn't be added to cart.");
              console.log(err);
              failedPromisesReturned++;
              if (successfulPromisesReturned +
                  failedPromisesReturned === itemDetails.length) {
                resolve();
              }
            }
          );
        })(v1);
      }
    });
  };

  // Actual init.
  $scope.itemRequestObjects = createRequestsFromItems($scope.itemDetailsFound);
  var very_sorry =
    "One or more of the items in your cart aren't actually available " +
    "right now because it's dinner time and they're lunch-only items or " +
    "something like that. Go back to the cart page and try removing the " +
    "offending item :*( I promise this will be fixed soon!!!";
  // Clear the user's cart.
  clearCartsPromise($scope.itemDetailsFound)
  .then(
    // At this point the cart should be cleared.
    function(res) {
      addCartsPromise($scope.itemDetailsFound, $scope.itemRequestObjects)
      .then(
        function(res) {
          // Cleared the cart and refreshed it with all our new items
          // YAY!
          // 
          // TODO(daddy): Card-related stuff goes here maybe. Actually we can
          // get it while we're getting the details maybe.
        },
        function(err) {
          alert(very_sorry);
          mainViewObj.removeClass();
          mainViewObj.addClass('slide-right');
          $location.path('/cart_page');
          return;
        }
      )
    },
    function(err) {
      // We can't ever get here because clearCartsPromise always resolves.
      alert(very_sorry);
      mainViewObj.removeClass();
      mainViewObj.addClass('slide-right');
      $location.path('/cart_page');
      return;
    }
  );
}]);
