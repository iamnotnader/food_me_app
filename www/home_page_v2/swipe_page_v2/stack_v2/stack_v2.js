/* jshint eqnull: true */

angular.module('foodMeApp.stackV2', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.controller('StackV2Ctrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$rootScope", "$timeout", "$q",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $rootScope, $timeout, $q) {
  var MAX_CARDS_IN_STACK = 3;
  var MAX_RESTAURANT_NAME_LENGTH = 32;
  var MAX_ITEM_NAME_LENGTH = 42;

  // Handles the user interaction with the card at the top of the stack.
  var getXAndYCoords = function(elem) {
    var matrixValues = elem.css('transform').replace('matrix(', '').replace(')', '').split(', ');
    return {
      startX: parseInt(matrixValues[4]),
      startY: parseInt(matrixValues[5]),
    };
  };

  var xStart, yStart, mainElem, mainElemStartX, mainElemStartY, posX, posY;
  var touchStart = false;
  var topCardHandler = function(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    switch (ev.type) {
      case 'touchstart':
        if (touchStart) {
          return false;
        }
        touchStart = true;
        console.log('touchstart');
        xStart = ev.originalEvent.touches[0].pageX;
        yStart = ev.originalEvent.touches[0].pageY;
        mainElem = $(this);
        if (mainElemStartX == null || mainElemStartY == null) {
          XYObj = getXAndYCoords(mainElem);
          mainElemStartX = XYObj.startX;
          mainElemStartY = XYObj.startY;
        }
        posX = mainElemStartX;
        posY = mainElemStartY;
        break;
      case 'mousedown':
        if (touchStart) {
          return false;
        }
        touchStart = true;
        console.log('mousedown');
        xStart = ev.pageX;
        yStart = ev.pageY;
        mainElem = $(this);
        if (mainElemStartX == null || mainElemStartY == null) {
          XYObj = getXAndYCoords(mainElem);
          mainElemStartX = XYObj.startX;
          mainElemStartY = XYObj.startY;
        }
        posX = mainElemStartX;
        posY = mainElemStartY;
        break;
      case 'mousemove':
      case 'touchmove':
        if (!touchStart) {
          return false;
        }
        var pageX = typeof ev.pageX == 'undefined' ? ev.originalEvent.touches[0].pageX : ev.pageX;
        var pageY = typeof ev.pageY == 'undefined' ? ev.originalEvent.touches[0].pageY : ev.pageY;
        var deltaX = parseInt(pageX) - parseInt(xStart);
        var deltaY = parseInt(pageY) - parseInt(yStart);
        posX = deltaX + mainElemStartX;
        posY = deltaY + mainElemStartY;
        var percent = deltaX * 1.0 / mainElem.width() * 100 / 2;

        mainElem.css("transform", "translate(" + posX + "px," + posY + "px) rotate(" + percent + "deg)");
        break;
      case 'mouseup':
      case 'touchend':
        if (!touchStart) {
          return false;
        }
        touchStart = false;
        console.log('touchend');
        var finalOffset = posX - mainElemStartX;
        var threshold = mainElem.width()/5;
        if (finalOffset > threshold) {
          $scope.likePressed();
        } else if (finalOffset < -threshold) {
          $scope.dislikePressed();
        } else if (finalOffset == 0) {
          // This piece prevents transforms from queuing up unless the card
          // actually moves.
          break;
        } else {
          mainElem.animate({
              transform: "translate(" + mainElemStartX + "px, " + mainElemStartY + "px)"
            },
            function() {
            }
          );
        }
        break;
    }
  };

  var getImageFromItemNamePromise = function(itemName) {
    var urlToFetch = 'https://ajax.googleapis.com/ajax/services/search/images?v=1.0&safe=active&imgsz=large&rsz='+
                      fmaSharedState.numImagesToFetch+'&q=' +
        itemName.split(/\s+/).join('+');
    return $q(function(resolve, reject) {
      $http.get(urlToFetch)
      .then(
        function(res) {
          if (res.data == null || res.data.responseData == null ||
              res.data.responseData.results == null ||
              res.data.responseData.results.length == 0 ||
              res.data.responseData.results[0].url == null) {
            resolve(null);
          }
          resolve(res.data.responseData.results[0].url);
          return;
        },
        function(err) {
          resolve(null);
        });
    });
  };

  var trimString = function(strToTrim, desiredLength) {
    // TODO(daddy): This function isn't perfect, but it gets the job done. In
    // particular, it leaves an inefficient three-character buffer just in case
    // we need to add ellipses at the end, even when it doesn't need to add
    // ellipses.
    desiredLength -= 3;
    var strPieces = strToTrim.split(' ');
    if (strPieces.length == 0 || strPieces[0].length > desiredLength) {
      // Don't trim if the string has no spaces.
      return strToTrim;
    }
    var testStr = '';
    var newStr = '';
    var strPieceIndex = 0;
    while (true) {
      newStr = testStr;
      if (strPieceIndex >= strPieces.length) {
        break;
      }
      testStr += strPieces[strPieceIndex] + ' ';
      strPieceIndex++;
      if (testStr.length >= desiredLength) {
        break;
      }
    }
    newStr = newStr.substring(0, newStr.length - 1);
    if (strPieceIndex < strPieces.length) {
      newStr = newStr + '...';
    }
    return newStr;
  };

  var fillCard = function(clonedCard, cardInfo) {
    console.log('fill card');
    // TODO(daddy): Limit the number of characters in the name.
    var nameElement = clonedCard.find('.stack__single_card__item_name_inner');
    nameElement.text(trimString(cardInfo.name, MAX_ITEM_NAME_LENGTH));

    var priceElement = clonedCard.find('.stack__single_card__item_price_inner');
    priceElement.text('$' + cardInfo.price);

    // Set a loading image until we get a real one back from Google.
    var imageElement = clonedCard.find('.stack__single_card__food_image');
    var loadingElement = clonedCard.find('.stack__single_card__food_image_loading');
    var textElement = clonedCard.find('.stack__single_card__food_image_waiting');
    getImageFromItemNamePromise(cardInfo.name)
    .then(
      function(res) {
        textElement.css({visibility: 'visible'});
        loadingElement.css({visibility: 'hidden'});
        if (res == null) {
          console.log('Error fetching image from Google.');
          return;
        }
        imageElement.css({
          background: "url('" + res + "') no-repeat center center",
          "background-size": "cover"
        });
      },
      function(err) {
        console.log('Error fetching image-- this should never happen because ' +
                    'we always resolve(null) instead of reject.');
      }
    );
    
  };

  var setEventHandlers = function(cardObj) {
    console.log('setEventHandlers');
    cardObj.bind('touchstart mousedown', topCardHandler);
    cardObj.bind('touchmove mousemove', topCardHandler);
    cardObj.bind('touchend mouseup', topCardHandler);
  };

  var initStackWithCards = function(cardInfoList, maxCardsInStack, stackContainer) {
    console.log('initStackWithCards');
    $scope.globals.allFoodItems = cardInfoList;

    if (cardInfoList == null || stackContainer == null) {
      console.log("Encountered null in initStackWithCards.");
      return;
    }
    var firstCard = stackContainer.children()[0];
    firstCard.remove();
    for (var ii = 0; ii < Math.min(cardInfoList.length, maxCardsInStack); ii++) {
      cardInfo = cardInfoList[($scope.globals.itemIndex + ii) % cardInfoList.length];
      var clonedCard = $(firstCard.cloneNode(true));
      fillCard(clonedCard, cardInfo);
      // This is slower but makes everything easier to reason about. The card on
      // the top is the last one in the DOM tree.
      stackContainer.prepend(clonedCard);
    }

    var stackCards = stackContainer.children();
    var currentCardDomIndex = stackCards.length - 1;
    var lastCard = $(stackCards[currentCardDomIndex]);
    lastCard.unbind();
    setEventHandlers(lastCard);
    setMerchantName();
  };

  var removeTopCardAddNewCard = function() {
    console.log('removeTopCardAddNewCard');
    // Remove the top card.
    var stackCards = $scope.stackContainer.children();
    var lastCard = $(stackCards[stackCards.length - 1]);
    lastCard.unbind();
    lastCard.remove();

    // We take a card that's not in the stack yet and put it in the stack at
    // the back. We loop if necessary.
    newLastCard = lastCard;
    newLastCard.css({transform: "translateX(-50%)translateY(-50%)"});
    var newCardDomIndex = ($scope.globals.itemIndex + stackCards.length) % $scope.globals.allFoodItems.length;
    var newCardInfo = $scope.globals.allFoodItems[newCardDomIndex];
    $scope.globals.itemIndex = ($scope.globals.itemIndex + 1) % $scope.globals.allFoodItems.length;

    fillCard(newLastCard, newCardInfo);
    $scope.stackContainer.prepend(newLastCard);

    stackCards = $scope.stackContainer.children();
    if (stackCards.length == 1) {
      var topCard = $(stackCards[0]);
      setEventHandlers(topCard);
    }

    // Set the event listeners on the new top card.
    stackCards = $scope.stackContainer.children();
    var topCard = $(stackCards[stackCards.length - 1]);
    setEventHandlers(topCard);
  };

  $scope.infoPressed = function() {
    console.log('info');
  };

  $scope.likePressed = function() {
    console.log('like');
    var stackCards = $scope.stackContainer.children();
    var lastCard = $(stackCards[stackCards.length - 1]);
    XAndY = getXAndYCoords(lastCard);
    lastCard.animate({
      transform: "translate(" +
          (XAndY.startX + 2*lastCard.width()) + "px, " +
          XAndY.startY + "px) rotate(100deg)"
      },
      300,
      function() {
        removeTopCardAddNewCard();
      }
    );
    // Add to cart...
    var itemInfo = $scope.globals.allFoodItems[$scope.globals.itemIndex];
    $scope.globals.userCart.push(itemInfo);
    $scope.globals.userCart = _.uniq($scope.globals.userCart);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', $scope.globals.userCart,
        fmaSharedState.foodItemValidationSeconds);
    $scope.globals.minimumLeft -= parseFloat(itemInfo.price);
    $scope.globals.minimumLeft = Math.max(0, $scope.globals.minimumLeft);
  };

  $scope.dislikePressed = function() {
    console.log('dislike');
    var stackCards = $scope.stackContainer.children();
    var lastCard = $(stackCards[stackCards.length - 1]);
    XAndY = getXAndYCoords(lastCard);
    lastCard.animate({
      transform: "translate(" +
          (XAndY.startX - 2*lastCard.width()) + "px, " +
          XAndY.startY + "px) rotate(-100deg)"
      },
      300,
      function() {
        removeTopCardAddNewCard();
      }
    );
  };

  var resetStack = function() {
    var firstCard;
    while ($scope.stackContainer.children().length > 1) {
      firstCard = $scope.stackContainer.children()[0];
      firstCard.remove();
    }
    firstCard = $($scope.stackContainer.children()[0]);
    firstCard.unbind();
    var imageElement = firstCard.find('.stack__single_card__food_image');
    var loadingElement = firstCard.find('.stack__single_card__food_image_loading');
    var textElement = firstCard.find('.stack__single_card__food_image_waiting');
    textElement.css({visibility: "hidden"});
    imageElement.css({
        background: "url('') no-repeat center center",
        "background-size": "cover"
    });
    // This is an ugly hack to make the gif refresh. Phonegap does some mangling
    // of the url's so we hae to get the old one, add a random query parameter
    // to it, then reset it.
    var oldBackground = loadingElement.css('background');
    var newBackground = oldBackground.substring(0, oldBackground.indexOf('.gif')) +
        '.gif?x=' + Math.random() + ')' +
        oldBackground.substring(oldBackground.indexOf(' no-repeat'));
    loadingElement.css({
      visibility: 'visible',
      background: newBackground,
      "background-size": "cover"
    });
    var nameElement = firstCard.find('.stack__single_card__item_name_inner');
    nameElement.text("");

    var priceElement = firstCard.find('.stack__single_card__item_price_inner');
    priceElement.text("");

    $scope.restaurantName.text("");
  };

  $scope.shuffleDishesPressed = function() {
    console.log('shuffleDishes');
    if ($scope.globals.allFoodItems == null) {
      return;
    }
    resetStack();
    $scope.globals.allFoodItems = _.shuffle($scope.globals.allFoodItems);
    $scope.globals.itemIndex = 0;
    initStackWithCards($scope.globals.allFoodItems, MAX_CARDS_IN_STACK, $scope.stackContainer);
  };

  var setMerchantName = function() {
    if ($scope.globals.allMerchants != null &&
        $scope.globals.allMerchants.length > $scope.globals.merchantIndex &&
        $scope.globals.allMerchants[$scope.globals.merchantIndex].summary != null &&
        $scope.globals.allMerchants[$scope.globals.merchantIndex].summary.name != null) {
      //TODO(daddy): Make sure name can't overflow.
      $scope.restaurantName.text(
          trimString($scope.globals.allMerchants[$scope.globals.merchantIndex].summary.name,
            MAX_RESTAURANT_NAME_LENGTH));
    }
  };

  $scope.shuffleMerchantsPressed = function() {
    console.log('shuffleMerchants');
    if ($scope.globals.allMerchants == null) {
      return;
    }
    // TODO(daddy): Warn the user before clearing the cart.
    $scope.globals.userCart = [];
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', $scope.globals.userCart,
        fmaSharedState.foodItemValidationSeconds);

    resetStack();

    $scope.globals.merchantIndex = ($scope.globals.merchantIndex + 1) % $scope.globals.allMerchants.length;
    var currentMerchant = $scope.globals.allMerchants[$scope.globals.merchantIndex];
    if (currentMerchant.ordering && currentMerchant.ordering.minimum) {
      $scope.globals.minimumLeft = parseFloat(currentMerchant.ordering.minimum);
    }
    setMerchantName();
    console.log('Minimum left: ' + $scope.globals.minimumLeft);
    getOpenDishesForMerchantPromise(currentMerchant)
    .then(
      function(res) {
        $scope.globals.itemIndex = 0;
        initStackWithCards(res, MAX_CARDS_IN_STACK, $scope.stackContainer);
      },
      function(err) {
        console.log('Error getting open dishes for merchant.');
        return;
      }
    );
  };

  var setCartTotal = function() {
    var total = 0.0;
    for (var v1 = 0; v1 < $scope.globals.userCart.length; v1++) {
      total += parseFloat($scope.globals.userCart[v1].price);
    }
    $scope.cartTotal = total.toFixed(2);
  };

  setCartTotal();
  $scope.$watch(
    function(scope) {
      // We only watch the cart length for efficiency reaasons.
      return scope.globals.userCart.length;
    },
    function() {
      setCartTotal();
  });

  var setMinimumString = function() {
    if ($scope.globals.minimumLeft === null ||
        $scope.globals.allMerchants == null) {
      $scope.minimumString = 'Delivery minmum:';
      return;
    }
    var currentMerchant = $scope.globals.allMerchants[$scope.globals.merchantIndex];
    var actualMinimum = -1.0;
    if (currentMerchant.ordering && currentMerchant.ordering.minimum) {
      actualMinimum = parseFloat(currentMerchant.ordering.minimum);
    }
    if (actualMinimum == $scope.globals.minimumLeft) {
      $scope.minimumString = 'Delivery minmum:';
      return;
    }

    if ($scope.globals.minimumLeft < 5 && $scope.globals.minimumLeft > 0) {
      $scope.minimumString = 'Almost there!';
    }
    else if ($scope.globals.minimumLeft === 0) {
      $scope.minimumString = 'You did it! Total:';
    }
    else {
      $scope.minimumString = 'Left to order: ';
    }
  };
  $scope.$watch('globals.minimumLeft', function() {
    setMinimumString();
  });
  setMinimumString();

  var filterBadName = function(nameStr) {
    if (nameStr == null) {
      return null;
    }
    var oldName = nameStr;
    regexes = fmaSharedState.dishNameFilterRegexes;
    for (var v1 = 0; v1 < regexes.length; v1++) {
      var currentRegex = regexes[v1];
      nameStr = nameStr.replace(currentRegex.pattern, currentRegex.replacement);
    }
    if (nameStr.split(/\s+/).length < 2) {
      return null;
    }
    return nameStr;
  };

  // Resolves to an array of dishes!
  var getOpenDishesForMerchantPromise = function(merchantObj) {
    return $q(function(resolve, reject) {
      if (merchantObj == null || merchantObj.summary == null ||
          merchantObj.summary.url == null ||
          merchantObj.summary.url.short_tag == null) {
        return resolve([]);
      }

      $http.get(fmaSharedState.endpoint+'/merchant/' +
          merchantObj.summary.url.short_tag +
          '/menu?iso=true&hide_unavailable=true&client_id=' +
          fmaSharedState.client_id)
      .then(
        function(res) {
          var menuArr = res.data.menu;

          // The forbidden items are things like tobacco and alcohol. We want to make
          // sure we filter these results out of our stack.
          var forbiddenItemIds = [];
          if (res.data.warnings != null && res.data.warnings.length > 0) {
            for (var v1 = 0; v1 < res.data.warnings.length; v1++) {
              var forbiddenObj = res.data.warnings[v1];
              forbiddenItemIds = forbiddenItemIds.concat(forbiddenObj.items);
            }
          }
          menuItemsFound = findMenuItems(menuArr, forbiddenItemIds);
          var foodData = [];
          for (var ii = 0; ii < menuItemsFound.length; ii++) {
            var currentItem = menuItemsFound[ii];
            currentItem.merchantName = he.decode(merchantObj.summary.name);
            currentItem.merchantDescription = merchantObj.summary.description;
            currentItem.merchantLogo = merchantObj.summary.merchant_logo;
            currentItem.merchantId = merchantObj.id;
            currentItem.merchantCuisines = merchantObj.summary.cuisines;

            // We use this to avoid duplicates in ng-repeat.
            currentItem.unique_key = currentItem.merchantId + '' + currentItem.id;
            currentItem.name = filterBadName(currentItem.name);
            if (currentItem.name == null || currentItem.merchantName == null ||
                currentItem.price == null) {
              continue;
            }
            // Add the tax and tip to make it accurate.
            //currentItem.price = (currentItem.price + deliveryCharge) *
            //    (1 + fmaSharedState.taxRate) + fmaSharedState.tipAmount;
            currentItem.price = currentItem.price.toFixed(2);

            foodData.push(currentItem);
          }

          resolve(foodData);
        },
        function(err) {
          // Messed up response???
          console.warn("Error getting menu for merchant.");
          reject(err);
        }
      );
    });
  };

  // Finds all of the "item" subobjects in the menuObj passed in. See
  // findMenuItems for more details.
  //
  // TODO(daddy): We should be mindful of the schedule. If a restaurant only
  // serves our item during breakfast but it's dinner time, that's no good...
  var findMenuItemsRecursive = function(menuObj, menuItemList, forbiddenItemIds) {
    // Check forbitten items. These are things like alcohol.
    if (forbiddenItemIds != null && forbiddenItemIds.length > 0) {
      for (var v1 = 0; v1 < forbiddenItemIds.length; v1++) {
        if (forbiddenItemIds[v1] === menuObj.id) {
          return;
        }
      }
    }

    if (menuObj.type === "item") {
      menuItemList.push(menuObj);
      return;
    }
    // If we're here, menuObj is a menu, not an item.
    for (var menuIndex = 0; menuIndex < menuObj.children.length; menuIndex++) {
      var menuSubObj = menuObj.children[menuIndex];
      findMenuItemsRecursive(menuSubObj, menuItemList);
    } 
    return menuItemList;
  };

  var findMenuItems = function(menuArr, forbiddenItemIds) {
    // menuArr is a list of objects of type "menu." An  object of type "menu" has children
    // that are either of type "menu" OR of type "item." If they're of type "item," we want
    // to return them.
    //
    // Because menuArr is not itself a menu, we cannot call findMenuItemRecursive on it directly.
    // That would have been nice because we would have had one line here.
    // Instead, we have to have this for loop here to pull out the actual menu objects and
    // call the function on them individually.
    var menuItemList = [];
    for (var menuIndex = 0; menuIndex < menuArr.length; menuIndex++) {
      if (menuArr[menuIndex] == null || menuArr[menuIndex].name == null ||
          menuArr[menuIndex].name.match(/beverage/i) != null) {
        continue;
      }
      findMenuItemsRecursive(menuArr[menuIndex], menuItemList, forbiddenItemIds);
    }
    return menuItemList;
  };

  var getMerchantsAndFoodItemsPromise = function(userAddress) {
    return $q(function(resolve, reject) {
      var searchAddress = fmaSharedState.addressToString(userAddress);
      $http.get(fmaSharedState.endpoint+'/merchant/search/delivery?' + 
                'address=' + searchAddress.split(/\s+/).join('+') + '&' + 
                'client_id=' + fmaSharedState.client_id + '&' +
                'enable_recommendations=false&' + 
                'iso=true&' +
                'order_time=ASAP&' +
                'order_type=delivery&' +
                'merchant_type=R' // &' +
                //'keyword=' + searchQuery.split(/\s+/).join('+')
      )
      .then(
      function(res) {
        var allNearbyMerchantData = res.data;
        var merchants = allNearbyMerchantData.merchants;
        // Shuffle up the merchants for fun.
        merchants = _.shuffle(merchants);
        merchants = _.filter(merchants, function(merchantObj) {
            return merchantObj && merchantObj.ordering &&
              merchantObj.ordering.is_open &&
              merchantObj.ordering.minutes_left_for_ASAP >= 10;
          }
        );
        if (merchants == null || merchants.length == 0) {
          console.log('Error: Response from merchant endoint ');
          reject('No merchants around.');
          return;
        }
        $scope.globals.merchantIndex = 0;
        $scope.globals.allMerchants = merchants;
        var currentMerchant = $scope.globals.allMerchants[$scope.globals.merchantIndex];
        if (currentMerchant.ordering && currentMerchant.ordering.minimum) {
          $scope.globals.minimumLeft = parseFloat(currentMerchant.ordering.minimum);
        }
        resolve(getOpenDishesForMerchantPromise(currentMerchant));
      },
      function(err) {
        console.log('Error searching address.');
        reject(err);
      });
    });
  };

  var initEverything = function() {
    $scope.$watch('globals.userAddress', function() {
      var userAddress = $scope.globals.userAddress;
      if (userAddress == null || userAddress == '') {
        console.log('No address-- not doing anything.');
        return;
      }
      console.log('hey, myVar has changed!');

      // Save the stackContainer so we can avoid crawling the dom.
      $scope.stackContainer = $('.stack__cards__cards_container');
      $scope.restaurantName = $('.stack__restaurant_name');
      if ($scope.globals.allFoodItems != null &&
          JSON.stringify($scope.globals.lastAddress) == JSON.stringify(userAddress)) {
        var currentMerchant = $scope.globals.allMerchants[$scope.globals.merchantIndex];
        if (currentMerchant.ordering && currentMerchant.ordering.minimum) {
          $scope.globals.minimumLeft = parseFloat(currentMerchant.ordering.minimum);
        }
        $scope.globals.minimumLeft = Math.max(0, $scope.globals.minimumLeft - $scope.cartTotal);

        // Start the array at the previous itemIndex.
        initStackWithCards(
            $scope.globals.allFoodItems,
            MAX_CARDS_IN_STACK,
            $scope.stackContainer);
        return;
      }

      $scope.globals.lastAddress = userAddress;
      resetStack();
      $scope.globals.userCart = [];
      fmaLocalStorage.setObjectWithExpirationSeconds(
          'userCart', $scope.globals.userCart,
          fmaSharedState.foodItemValidationSeconds);
      getMerchantsAndFoodItemsPromise(userAddress).then(
        function(res) {
          $scope.globals.itemIndex = 0;
          initStackWithCards(res, MAX_CARDS_IN_STACK, $scope.stackContainer);
        },
        function(err) {
          console.log('There was a problem with getMerchantsAndFoodItemsPromise.');
        } 
      );
    });
  };

  initEverything();
}]);
