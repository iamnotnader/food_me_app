/* jshint eqnull: true */

angular.module('foodMeApp.stackV2', ['ngRoute', 'foodmeApp.localStorage', 'foodmeApp.sharedState', 'ionic'])

.controller('StackV2Ctrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$rootScope", "$timeout", "$q", "$ionicPopup",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $rootScope, $timeout, $q, $ionicPopup) {
  var MAX_CARDS_IN_STACK = 3;
  var MAX_RESTAURANT_NAME_LENGTH = 32;
  var MAX_ITEM_NAME_LENGTH = 42;
  var ANIMATION_TIME_MS = 200;

  // Handles the user interaction with the card at the top of the stack.
  var getXAndYCoords = function(elem) {
    var matrixValues = elem.css('transform').replace('matrix(', '').replace(')', '').split(', ');
    return {
      startX: parseInt(matrixValues[4]),
      startY: parseInt(matrixValues[5]),
    };
  };

  // We need this function because animate() doesn't work with translate3d or rotate3d unless
  // we use this complicated step function thingy. We really want to use the 3d functions
  // because they utilize the GPU and are generally way faster.
  var set3dAnimation = function(mainElem, duration, callback, finalX, finalY, finalDegrees) {
    console.log('animating 3d');
    mainElem.css('interpolator', 0);
    var beginningXAndY = getXAndYCoords(mainElem);
    var beginningDegrees = mainElem.rotationDegrees();
    mainElem.animate({ interpolator: 1 }, {
        step: function(now,fx) {
            var currentX = (1 - now)*(beginningXAndY.startX) + now*(finalX);
            var currentY = (1 - now)*(beginningXAndY.startY) + now*(finalY);
            var currentDegrees = (1 - now)*(beginningDegrees) + now*(finalDegrees);
            mainElem.css('transform', 'translate3d(' + currentX + 'px, ' + currentY + 'px, 0) rotate3d(0, 0, 1, ' + currentDegrees + 'deg)');
        },
        duration: duration,
        complete: callback
    },'swing');
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

        mainElem.css("transform", "translate3d(" + posX + "px," + posY + "px, 0px) rotate3d(0,0,1," + percent + "deg)");
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
        } else if (finalOffset === 0 && getXAndYCoords(mainElem).startY === mainElemStartY) {
          // This piece prevents transforms from queuing up unless the card
          // actually moves.
          break;
        } else {
          console.log('touchend');
          set3dAnimation(mainElem, ANIMATION_TIME_MS, function() {}, mainElemStartX, mainElemStartY, 0);
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
              res.data.responseData.results[0] == null ||
              res.data.responseData.results[0].url == null) {
            resolve(null);
            return;
          }
          resolve(res.data.responseData.results[0].url);
          return;
        },
        function(err) {
          resolve(null);
          return;
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
          imageElement.css({
            background: "url('') no-repeat center center",
            "background-size": "cover"
          });
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
    $scope.canManipulateCards = true;
    cardObj.bind('touchstart mousedown', topCardHandler);
    cardObj.bind('touchmove mousemove', topCardHandler);
    cardObj.bind('touchend mouseup', topCardHandler);
  };

  // If we find that a merchant has no dishes, we set this variable as a signal
  // that we should show a null state instead of showing the stack. It's shitty but
  // right now you have to make sure you unset it when you go to a new merchant.
  $scope.emptyStackConfirmed = false;
  var initStackWithCards = function(cardInfoList, maxCardsInStack, stackContainer) {
    console.log('initStackWithCards');
    // Shuffle the food items to keep things fun.
    $scope.globals.allFoodItems = cardInfoList;
    if ($scope.globals.allFoodItems == null ||
        $scope.globals.allFoodItems.length === 0) {
      $scope.canManipulateCards = true;
      $scope.emptyStackConfirmed = true;
      return;
    }

    if (cardInfoList == null || stackContainer == null) {
      console.log("Encountered null in initStackWithCards.");
      return;
    }
    // Start the array at the previous itemIndex.
    while ($scope.stackContainer.children().length > 1) {
      firstCard = $scope.stackContainer.children()[0];
      firstCard.remove();
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
    $scope.canManipulateCards = false;
    lastCard.unbind();
    setEventHandlers(lastCard);
  };

  var removeTopCardAddNewCard = function() {
    console.log('removeTopCardAddNewCard');
    // Remove the top card.
    var stackCards = $scope.stackContainer.children();
    var lastCard = $(stackCards[stackCards.length - 1]);
    $scope.canManipulateCards = false;
    lastCard.unbind();
    lastCard.remove();

    // We take a card that's not in the stack yet and put it in the stack at
    // the back. We loop if necessary.
    newLastCard = lastCard;
    newLastCard.css({transform: "translate3d(-50%, -50%, 0)"});
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
    $scope.globals.updateTutorialIndex(0);
  };

  $scope.likePressed = function() {
    console.log('like');
    if (!$scope.canManipulateCards || $scope.emptyStackConfirmed) {
      console.log('Not liking because can\'t manipulate cards');
      return;
    }
    var stackCards = $scope.stackContainer.children();
    var lastCard = $(stackCards[stackCards.length - 1]);
    XAndY = getXAndYCoords(lastCard);
    set3dAnimation(
      lastCard,
      ANIMATION_TIME_MS,
      function() {
        removeTopCardAddNewCard();
      },
      XAndY.startX + 2*lastCard.width(),
      XAndY.startY,
      100
    );
    // Add to cart...
    var itemInfo = $scope.globals.allFoodItems[$scope.globals.itemIndex];
    $scope.globals.userCart.push(itemInfo);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', $scope.globals.userCart,
        fmaSharedState.foodItemValidationSeconds);
  };

  $scope.dislikePressed = function() {
    console.log('dislike');
    if (!$scope.canManipulateCards || $scope.emptyStackConfirmed) {
      console.log('Not disliking because can\'t manipulate cards');
      return;
    }
    var stackCards = $scope.stackContainer.children();
    var lastCard = $(stackCards[stackCards.length - 1]);
    XAndY = getXAndYCoords(lastCard);
    set3dAnimation(
      lastCard,
      ANIMATION_TIME_MS,
      function() {
        removeTopCardAddNewCard();
      },
      XAndY.startX - 2*lastCard.width(),
      XAndY.startY,
      -100
    );
  };

  var resetStack = function() {
    var firstCard;
    while ($scope.stackContainer.children().length > 1) {
      firstCard = $scope.stackContainer.children()[0];
      firstCard.remove();
    }
    firstCard = $($scope.stackContainer.children()[0]);
    $scope.canManipulateCards = false;
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

  var putFirstCardBack = function() {
    console.log('Putting card back.');
    // Remove the top card.
    var stackCards = $scope.stackContainer.children();
    var oldTopCard = $(stackCards[stackCards.length - 1]);
    $scope.canManipulateCards = false;
    oldTopCard.unbind();

    // We take a card that's not in the stack yet and put it in the stack at
    // the front. We loop if necessary.
    newTopCard = oldTopCard.clone();
    XAndY = getXAndYCoords(oldTopCard);
    newTopCard.css('transform',
        "translate3d(" +
            (XAndY.startX - 2*oldTopCard.width()) + "px, " +
            XAndY.startY + "px, 0px) rotate3d(0, 0, 1, -100deg)"
    );
    var imageElement = newTopCard.find('.stack__single_card__food_image');
    if (imageElement != null) {
      imageElement.css('background', "");
    }
    var numItems = $scope.globals.allFoodItems.length;
    var previousItemIndex = ($scope.globals.itemIndex + numItems - 1) % numItems;
    $scope.globals.itemIndex = previousItemIndex;
    var newCardInfo = $scope.globals.allFoodItems[previousItemIndex];

    fillCard(newTopCard, newCardInfo);
    $scope.stackContainer.append(newTopCard);
    set3dAnimation(
      newTopCard,
      ANIMATION_TIME_MS,
      function() {
        setEventHandlers(newTopCard);
      },
      XAndY.startX,
      XAndY.startY,
      0
    );
    stackCards = $scope.stackContainer.children();
    if (stackCards.length == 1) {
      return;
    }
    var lastCard = $(stackCards[0]);
    lastCard.remove();
  }

  // This is now a back button.
  $scope.lastDishPressed = function() {
    console.log('shuffleDishes');
    if (!$scope.canManipulateCards || $scope.emptyStackConfirmed) {
      console.log('Not shuffling dishes because can\'t manipulate cards');
      return;
    }
    putFirstCardBack();
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

  var actuallyShuffleMerchants = function() {
    $scope.emptyStackConfirmed = false;

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
  }

  $scope.shuffleMerchantsPressed = function() {
    console.log('shuffleMerchants');
    if (!$scope.canManipulateCards) {
      console.log('Not shuffling merchants because can\'t manipulate cards');
      return;
    }
    if ($scope.globals.userCart != null &&
        $scope.globals.userCart.length > 0) {
      var confirmPopup = $ionicPopup.confirm({
        title: 'Burgie says...',
        template: 'Yo. Going to the next merchant will clear your cart-- you ok with this?',
        cancelText: 'Nah',
        okText: 'Yeah',
      });
      confirmPopup.then(function(res) {
        if(res) {
          console.log('Yay shuffling merchants');
          actuallyShuffleMerchants();
        } else {
          console.log('Staying on current merchant.');
        }
      });
      return;
    }
    actuallyShuffleMerchants();
  };

  var setCartTotal = function() {
    $scope.cartTotal = $scope.globals.computeCartTotal($scope.globals.userCart).toFixed(2);
  };
  var setMinimumLeft = function() {
    if ($scope.globals.allMerchants == null ||
       $scope.globals.merchantIndex == null) {
      console.log('Not adjusting minimum because allMerchants or merchantIndex is null');
      return;
    }
    var currentMerchant = $scope.globals.allMerchants[$scope.globals.merchantIndex];
    if (currentMerchant.ordering == null || currentMerchant.ordering.minimum == null ||
        $scope.globals.userCart == null) {
      console.log('Not adjusting minimum because minimum or cart is null.');
      return;
    }

    actualMinimum = parseFloat(currentMerchant.ordering.minimum);
    var cartTotal = $scope.globals.computeCartTotal($scope.globals.userCart);
    $scope.globals.minimumLeft = Math.max(0, actualMinimum - cartTotal);
  }

  setCartTotal();
  $scope.$watch(
    function(scope) {
      // We only watch the cart length for efficiency reaasons.
      return scope.globals.userCart.length;
    },
    function() {
      setCartTotal();
      setMinimumLeft();
  });

  var setMinimumString = function() {
    if ($scope.globals.minimumLeft === null ||
        $scope.globals.allMerchants == null) {
      $scope.minimumString = 'Delivery minimum:';
      return;
    }
    var currentMerchant = $scope.globals.allMerchants[$scope.globals.merchantIndex];
    var actualMinimum = -1.0;
    if (currentMerchant.ordering && currentMerchant.ordering.minimum) {
      actualMinimum = parseFloat(currentMerchant.ordering.minimum);
    }
    if (actualMinimum == $scope.globals.minimumLeft) {
      $scope.minimumString = 'Delivery minimum:';
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

          // Shuffle the results for fun.
          foodData = _.shuffle(foodData);
          // Sort foodData to put the matched items at the front.
          if ($scope.globals.keywordValue != null && $scope.globals.keywordValue != '' &&
              merchantObj.matched_items != null) {
            foodData = _.sortBy(foodData, function(foodItem) {
              if (merchantObj.matched_items[foodItem.unique_id] != null) {
                return 0;
              }
              return 1;
            });
          }
          return resolve(foodData);
        },
        function(err) {
          // Messed up response???
          console.warn("Error getting menu for merchant.");
          return reject(err);
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
      var keywordParam = '';
      if ($scope.globals.keywordValue != null &&
          $scope.globals.keywordValue != '') {
        keywordParam = '&keyword=' + $scope.globals.keywordValue.split(/\s+/).join('+')
      }
      $http.get(fmaSharedState.endpoint+'/merchant/search/delivery?' + 
                'address=' + searchAddress.split(/\s+/).join('+') + '&' + 
                'client_id=' + fmaSharedState.client_id + '&' +
                'enable_recommendations=false&' + 
                'iso=true&' +
                'order_time=ASAP&' +
                'order_type=delivery&' +
                'merchant_type=R' +
                keywordParam
      )
      .then(
      function(res) {
        var allNearbyMerchantData = res.data;
        var merchants = allNearbyMerchantData.merchants;
        // Shuffle up the merchants for fun.
        merchants = _.shuffle(merchants);
        merchants = _.filter(merchants, function(merchantObj) {
            var goodMerchant = true;
            goodMerchant = goodMerchant &&
                merchantObj != null &&
                merchantObj.ordering != null &&
                merchantObj.ordering.is_open &&
                merchantObj.ordering.minutes_left_for_ASAP >= 10;
            if (keywordParam != '') {
              goodMerchant = goodMerchant &&
                  merchantObj.is_matching_items;
            }
            if ($scope.globals.deliveryMinimumLimit != null &&
                merchantObj.ordering.minimum != null) {
              goodMerchant = goodMerchant &&
                  merchantObj.ordering.minimum <= $scope.globals.deliveryMinimumLimit;
            }
            return goodMerchant;
          }
        );
        if (merchants == null || merchants.length === 0) {
          console.log('Error: No merchants around.');
          reject('No merchants around.');
          return;
        }
        $scope.globals.allMerchants = merchants;
        $scope.globals.merchantIndex = _.findIndex(
            $scope.globals.allMerchants,
            function(merchantObj) {
              return merchantObj.id == $scope.globals.selectedMerchantId;
            }
        );
        if ($scope.globals.merchantIndex < 0) {
          $scope.globals.merchantIndex = 0;
        }
        var currentMerchant = $scope.globals.allMerchants[$scope.globals.merchantIndex];
        if (currentMerchant.ordering && currentMerchant.ordering.minimum) {
          $scope.globals.minimumLeft = parseFloat(currentMerchant.ordering.minimum);
          setMerchantName();
        }
        return resolve(getOpenDishesForMerchantPromise(currentMerchant));
      },
      function(err) {
        console.log('Error searching address.');
        return reject(err);
      });
    });
  };

  $scope.initEverything = function() {
    $scope.emptyStackConfirmed = false;
    var userAddress = $scope.globals.userAddress;
    if (userAddress == null || userAddress == '') {
      console.log('No address-- not doing anything.');
      return;
    }
    var currentSearch =
        JSON.stringify($scope.globals.selectedMerchantId) +
        JSON.stringify($scope.globals.deliveryMinimumLimit) +
        JSON.stringify($scope.globals.keywordValue);
    console.log(currentSearch + ' ' + $scope.globals.lastSearch);

    // Save the stackContainer so we can avoid crawling the dom.
    $scope.stackContainer = $('.stack__cards__cards_container');
    $scope.restaurantName = $('.stack__restaurant_name');
    if ($scope.globals.allFoodItems != null &&
        JSON.stringify($scope.globals.lastAddress) == JSON.stringify(userAddress) &&
        $scope.globals.lastSearch == currentSearch) {
      console.log('Not refreshing stack.');
      var currentMerchant = $scope.globals.allMerchants[$scope.globals.merchantIndex];
      if (currentMerchant.ordering && currentMerchant.ordering.minimum) {
        $scope.globals.minimumLeft = parseFloat(currentMerchant.ordering.minimum);
      }
      setMerchantName();
      $scope.globals.minimumLeft = Math.max(0, $scope.globals.minimumLeft - $scope.cartTotal);

      initStackWithCards(
          $scope.globals.allFoodItems,
          MAX_CARDS_IN_STACK,
          $scope.stackContainer);
      return;
    }

    $scope.globals.minimumLeft = null;
    $scope.globals.lastAddress = userAddress;
    $scope.globals.lastSearch = currentSearch;
    resetStack();
    $scope.globals.userCart = [];
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', $scope.globals.userCart,
        fmaSharedState.foodItemValidationSeconds);
    getMerchantsAndFoodItemsPromise(userAddress).then(
      function(res) {
        $scope.globals.itemIndex = 0;
        var currentMerchant = $scope.globals.allMerchants[$scope.globals.merchantIndex];
        if (currentMerchant.ordering && currentMerchant.ordering.minimum) {
          $scope.globals.minimumLeft = parseFloat(currentMerchant.ordering.minimum);
        }
        setMerchantName();
        initStackWithCards(res, MAX_CARDS_IN_STACK, $scope.stackContainer);
      },
      function(err) {
        $scope.emptyStackConfirmed = true;
        // Pretty hackey. We probably need to null out some other things too.
        $scope.globals.allMerchants = null;
        $scope.globals.allFoodItems = null;
        $scope.globals.merchantIndex = null;
        if (($scope.globals.keywordValue != null && $scope.globals.keywordValue !== '') ||
            $scope.globals.selectedMerchantId !== fmaSharedState.default_merchant_id ||
            $scope.globals.deliveryMinimumLimit <= 15) {
          var confirmPopup = $ionicPopup.confirm({
            title: 'Burgie says...',
            template: 'Shoot. There aren\'t any open, matching restaurants nearby. Want to loosen your search preferences?',
            cancelText: 'Nah',
            okText: 'Yeah',
          });
          confirmPopup.then(function(res) {
            if(res) {
              console.log('Loosening search prefs.');
              $scope.searchButtonPressed();
            } else {
              console.log('Not loosening search prefs..');
            }
          });
        }
        console.log('There was a problem with getMerchantsAndFoodItemsPromise.');
      } 
    );
  };

  $scope.$watch('globals.userAddress', function() {
    console.log('Address has changed.');
    $scope.initEverything();
  });
}]);
