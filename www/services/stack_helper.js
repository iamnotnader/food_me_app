/*jshint loopfunc: true, eqnull: true */

// A utility that fetches data to be shown in the stack. Fetches
// the following things:
//  - allNearbyMerchantData: Basically a response that contains
//    data about all merchants in the vicinity.
//  - foodData: The dishes extracted from allNearbyMerchantData
//    that match the desired cuisines.
//  - foodImageLinks: An object full of links, one for each foodData.
//    Might contain fewer elements than foodData.

angular.module('foodMeApp.stackHelper', ['foodmeApp.localStorage', 'foodmeApp.sharedState'])

.factory('fmaStackHelper', ["fmaLocalStorage", "$http", "fmaSharedState", "$q", "$timeout",
function(fmaLocalStorage, $http, fmaSharedState, $q, $timeout) {
  // Go through the a schedule array and return the ones that are open right now.
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

  // Go through an array of menus and only returns the ones that correspond
  // to schedules that are open.
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
      findMenuItemsRecursive(menuArr[menuIndex], menuItemList, forbiddenItemIds);
    }
    return menuItemList;
  };

  // Resolves to an array of dishes!
  var getOpenDishesForMerchantPromise = function(merchant_id) {
    return $q(function(resolve, reject) {
      $http.get(fmaSharedState.endpoint+'/merchant/'+merchant_id+'/menu?client_id=' + fmaSharedState.client_id)
      .then(
        function(res) {
          var menuArr = res.data.menu;
          // TODO(daddy): Culling down the menus like this is necessary for
          // now, but in the long run the food should be culled down before
          // the swipe page.
          menuArr = openMenus(menuArr, res.data.schedule);
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

          resolve(menuItemsFound);
        },
        function(err) {
          // Messed up response???
          console.warn("Problem getting menu.");
          reject(err);
        }
      );
    });
  };

  // This is called if we don't find the merchant and food data in our localStorage.
  var asyncGetMerchantAndFoodData = function(latitude, longitude, token, cuisines, numMerchantsToFetch) {
    console.log('Asynchronously getting merchant data.');
    // HTTP request to get all the stuff, then process it into a list of food.
    return $q(function(resolve, reject) {
      $http.defaults.headers.common.Authorization = token;
      $http.get(fmaSharedState.endpoint + '/merchant/search/delivery?' + 
                'client_id=' + fmaSharedState.client_id + '&' +
                'latitude=' + latitude + '&' +
                'longitude=' + longitude + '&' +
                'merchant_type=R&' +
                'access_token=' + token
      )
      .then(
      function(res) {
        var allNearbyMerchantData = res.data;
        var merchants = allNearbyMerchantData.merchants;
        // Shuffle up the merchants for fun.
        merchants = _.shuffle(merchants);
        var cuisinesOverlap = function(merchantCuisines, cuisines) {
          if (merchantCuisines == null) {
            return false;
          }
          for (var mCuis = 0; mCuis < merchantCuisines.length; mCuis++) {
            for (var uCuis = 0; uCuis < cuisines.length; uCuis++) {
              if (cuisines[uCuis] != null &&
                  merchantCuisines[mCuis] === cuisines[uCuis].name) {
                  return true;
              }
            }
          }
        };
        var foodData = [];
        var currentNumMerchantsToFetch = Math.min(merchants.length, numMerchantsToFetch);
        console.log(currentNumMerchantsToFetch);
        var merchantsBeingFetched = 0;
        var merchantIndex = 0;
        var numMerchantsFetched = 0;
        while (merchantIndex < merchants.length) {
          if (merchantsBeingFetched > currentNumMerchantsToFetch) {
            // If we're fetching enough merchants, no need to keep going.
            break;
          }
               
          var outerCurrentMerchant = merchants[merchantIndex];
          if (!outerCurrentMerchant.ordering.is_open) {
            merchantIndex++;
            continue;
          }
          // TODO(securitythreat): Sigh.. this loop is O(mn) where m = merchant
          // cuisines and n = selected cuisines.
          var merchantCuisines = outerCurrentMerchant.summary.cuisines;
          if (!cuisinesOverlap(merchantCuisines, cuisines)) {
            merchantIndex++;
            continue;
          }
          (function(merchIndex) {
            var innerCurrentMerchant = merchants[merchIndex];
            getOpenDishesForMerchantPromise(innerCurrentMerchant.id)
            .then(
              function(menuItemsFound) {
                for (var v1 = 0; v1 < menuItemsFound.length; v1++) {
                  var currentItem = menuItemsFound[v1];
                  currentItem.merchantName = he.decode(innerCurrentMerchant.summary.name);
                  currentItem.merchantDescription = innerCurrentMerchant.summary.description;
                  currentItem.merchantLogo = innerCurrentMerchant.summary.merchant_logo;
                  currentItem.merchantId = innerCurrentMerchant.id;
                  currentItem.merchantCuisines = innerCurrentMerchant.summary.cuisines;
                  // We use this to avoid duplicates in ng-repeat.
                  currentItem.unique_key = currentItem.merchantId + currentItem.id;
                  if (currentItem.name == null || currentItem.merchantName == null ||
                      currentItem.price == null ||
                      currentItem.price > fmaSharedState.maxPriceToShowUSD ||
                      (innerCurrentMerchant.ordering.minimum != null &&
                       currentItem.price < innerCurrentMerchant.ordering.minimum)) {
                    continue;
                  }
                  // Add the tax and tip to make it accurate.
                  currentItem.price = currentItem.price * (1 + fmaSharedState.taxRate) + fmaSharedState.tipAmount;
                  currentItem.price = currentItem.price.toFixed(2);

                  // Get rid of number like "55. Turkey Sandwich" -> "Turkey Sandwich"
                  currentItem.name = currentItem.name.replace(/[0-9a-zA-z]+\.\s+/, '').replace(/\s+-\s+/, ' ').replace(/\s*choose\s+[0-9]+/i, '');
                  foodData.push(currentItem);
                }
                numMerchantsFetched++;
                console.log(numMerchantsFetched);
                if (numMerchantsFetched === currentNumMerchantsToFetch) {
                  // Shuffle up the dishes for fun.
                  foodData = _.shuffle(foodData);
                  // Limit the number of dishes we return to prevent oom. 
                  foodData = foodData.slice(0, fmaSharedState.maxDishesToReturn);
                  console.log(foodData);
                  resolve({
                    allNearbyMerchantData: allNearbyMerchantData,
                    foodData: foodData
                  });
                }
              },
              function(err) {
                console.warn("Problem fetching data for one of the merchants.");
                console.warn(err);
                numMerchantsFetched++;
              }
            );
          })(merchantIndex);
          merchantIndex++;
          merchantsBeingFetched++;
        }
        // This line makes it so that if we have fewer than currentNumMerchantsToFetch,
        // we still break out of the promise.
        currentNumMerchantsToFetch = merchantsBeingFetched;
        if (merchantsBeingFetched === 0) {
          reject('No merchants to fetch.');
        }

        // Return all the data (woo!)
      },
      function(err) {
        console.log('Error occurred getting allNearbyMerchantData.');
        console.log(JSON.stringify(err));
        reject(err);
      });
    });
  };

  // This is called if we don't find the image data for each item in localStorage.
  // Will be called AFTER asyncGetMerchantAndFoodData.
  //
  // Getting images is a heavy-weight operation, so we allow the caller to pass
  // in an foodDataCursor, which tells us what index to start fetching at in
  // foodData.
  var asyncGetFoodImageLinks = function(foodData, foodDataCursor, numPicsToFetch) {
    console.log('Asynchronously getting all the image data.');

    if (numPicsToFetch === 0) {
      return $q(function(resolve, reject) {
        resolve({ foodImageLinks: [] })
      });
    };

    // Remove the images that 404.
    var cleanImagesPromise = function(imageUrls) {
      var numImagesReturned = 0;
      var goodUrls = [];
      return $q(function(resolve, reject) {
        if (imageUrls.length === 0) {
          reject('no pics.');
        }
        for (var v1 = 0; v1 < imageUrls.length; v1++) {
          (function(imageIndex) {
            $http.get(imageUrls[imageIndex]).then(
              function(res) {
                numImagesReturned++;
                goodUrls.push(imageUrls[imageIndex]);
                // Comment this in if you want to get as many images as possible.
                // Right now we prefer to only fetch one and not wait for the others.
                //if (numImagesReturned === imageUrls.length) {
                  resolve(goodUrls);
                //}
              },
              function(err) {
                numImagesReturned++;
                if (numImagesReturned === imageUrls.length) {
                  resolve(goodUrls);
                }
              }
            );
          })(v1);
        }
      });
    };

    // Sorry the below code is a little confusing-- I'm not a huge fan of
    // Google's API. We actually process the images in searchComplete.
    return $q(function(resolve, reject) { 
      var foodImageLinks = [];
      for (var x = 0; x < numPicsToFetch; x++) {
        // Need a closure to preserve the loop index.
        (function(index) {
          var foodDataObj = foodData[foodDataCursor + index];
          // We try to detect "double encoding" by looking for %2520, which is
          // what you get when you try to double-encode a space character.
          var urlToFetch = 'https://ajax.googleapis.com/ajax/services/search/images?v=1.0&q=' +
              foodDataObj.name.split(' ').join('+');
          $http.get(urlToFetch)
          .then(
            function(res) {
              var imageDataList = res.data.responseData.results; 
              var currentLinkObj = {};
              currentLinkObj.index = index;
              currentLinkObj.foodDataId = foodDataObj.id;
              currentLinkObj.urls = [];
              currentLinkObj.name = foodDataObj.name;
              for (var y = 0; y < imageDataList.length; y++) {
                currentLinkObj.urls.push(unescape(imageDataList[y].url)); 
              } 
              cleanImagesPromise(currentLinkObj.urls).then(
                function(res) {
                  currentLinkObj.urls = res;
                  foodImageLinks.push(currentLinkObj);
                  if (foodImageLinks.length == numPicsToFetch) {
                    foodImageLinks.sort(function(a, b) {
                      return a.index - b.index;
                    });
                    resolve({foodImageLinks: foodImageLinks});
                  }
                },
                function(err) {
                  console.warn('cleanImages should never ERR.');
                  reject(err);
                });
            },
            function(err) {
              var currentLinkObj = {};
              currentLinkObj.index = index;
              currentLinkObj.foodDataId = foodDataObj.id;
              foodImageLinks.push(currentLinkObj);
              if (foodImageLinks.length == numPicsToFetch) {
                resolve({foodImageLinks: foodImageLinks});
              }
            });
        })(x);
      }
    });
  };

  var setUpDataVariables = function(latitude, longitude, token, cuisines, numPicsToFetch, numMerchantsToFetch, forceRefresh) {
    var retVars = {};
    return $q(function(resolve, reject) {
      // This is a hack but if we're loading for more than some amount of time
      // we need to gtfo.
      $timeout(function() {
        console.log('loading timed out.');
        reject('timed out.');
      }, fmaSharedState.promiseTimeoutMs);

      // If we're missing any of the necessary data just refetch errything.
      if (forceRefresh ||
          !fmaLocalStorage.isSet('allNearbyMerchantData') ||
          !fmaLocalStorage.isSet('foodData') ||
          !fmaLocalStorage.isSet('foodImageLinks')) {
        console.log('We need to refetch food data (sadly)');
        asyncGetMerchantAndFoodData(latitude, longitude, token, cuisines, numMerchantsToFetch).then(
          function(allData) {
            console.log('Got all the merchant and food data!');
            // This is the giant response we get back from delivery.com.
            retVars.allNearbyMerchantData = allData.allNearbyMerchantData;
            // Array of food items, one for each card.
            retVars.foodData = allData.foodData;
            return asyncGetFoodImageLinks(retVars.foodData, 0, 
                Math.min(numPicsToFetch, retVars.foodData.length));
          },
          function(err) {
            console.log("Error getting merchant data WTF.");
            console.log(JSON.stringify(err));
            alert("We haad a weird problem. Uh.. try restarting the app.");
            reject(err);
        }).then(
          function(allData) {
            console.log('Got all the image data!');
            // Array of objects with images in them, one for each card.
            retVars.foodImageLinks = allData.foodImageLinks;                

            // Put everything in localStorage for the future.
            fmaLocalStorage.setObjectWithExpirationSeconds(
                'allNearbyMerchantData', retVars.allNearbyMerchantData,
                fmaSharedState.testing_invalidation_seconds);
            fmaLocalStorage.setObjectWithExpirationSeconds(
                'foodData', retVars.foodData,
                fmaSharedState.testing_invalidation_seconds);
            fmaLocalStorage.setObjectWithExpirationSeconds(
                'foodImageLinks', retVars.foodImageLinks,
                fmaSharedState.testing_invalidation_seconds);

            // Now we can continue with the rest of the setup.
            resolve(retVars);
          },
          function(err) {
            console.log("Error getting merchant data WTF.");
            console.log(JSON.stringify(err));
            alert("We haad a weird problem. Uh.. try restarting the app.");
            reject(err);
        });
      } else {
        console.log('Got all our data from localstorage (woo!)');
        // In this case, everything is already in the cache already so just get it.

        // This is the giant response we get back from delivery.com.
        retVars.allNearbyMerchantData = fmaLocalStorage.getObject('allNearbyMerchantData');
        // Array of food items, one for each card.
        retVars.foodData = fmaLocalStorage.getObject('foodData');
        // Array of objects with images in them, one for each card.
        retVars.foodImageLinks = fmaLocalStorage.getObject('foodImageLinks');
        
        // Now we can continue with the rest of the setup.
        resolve(retVars);
      } 
    });
  };

  return {
    setUpDataVariables: setUpDataVariables,
    asyncGetFoodImageLinks: asyncGetFoodImageLinks,
    getOpenDishesForMerchantPromise: getOpenDishesForMerchantPromise,
  };
}]);
