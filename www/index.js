/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

var ga_id = null;
//Set up the main app module and pull in all the dependencies.
var initAngularStuff = function() {
  // Declare app level module which depends on views, and components
  console.log('Engaging angular.');
  angular.module('foodMeApp', [
    'ionic',
    'ngAnimate',
    'ui.router',
    'ngIOS9UIWebViewPatch',
    'foodMeApp.introScreen',
    'foodMeApp.chooseCard',
    'foodmeApp.sharedState',
    'foodMeApp.accountsPage',
    'foodMeApp.addCard',
    'foodMeApp.addPhone',
    'foodMeApp.homePageV2',
    'foodMeApp.chooseAddressV3',
    'foodMeApp.partialSwipePageV2',
    'foodMeApp.stackV2',
    'foodMeApp.cartPageV2',
    'foodMeApp.searchPageV2',
  ]).
  config(['$stateProvider', '$urlRouterProvider',
      function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider
      .otherwise('/intro_screen');
    $stateProvider
      .state('intro_screen', {
          url: '/intro_screen',
          templateUrl: 'intro_screen/intro_screen.html',
          controller: 'IntroScreenCtrl'
      })
      .state('accounts_page', {
          url: '/accounts_page',
          templateUrl: 'accounts_page/accounts_page.html',
          controller: 'AccountsPageCtrl'
      })
      .state('add_card', {
          url: '/add_card',
          templateUrl: 'add_card/add_card.html',
          controller: 'AddCardCtrl'
      })
      .state('choose_card', {
          url: '/choose_card',
          templateUrl: 'choose_card/choose_card.html',
          controller: 'ChooseCardCtrl'
      })
      .state('add_phone', {
          url: '/add_phone',
          templateUrl: 'add_phone/add_phone.html',
          controller: 'AddPhoneCtrl'
      })
      // This is going to be our new app below.
      .state('home_page_v2', {
          url: '/home_page_v2',
          templateUrl: 'home_page_v2/partial_home_page_v2.html',
          controller: 'HomePageV2Ctrl'
      })
      .state('home_page_v2.search_page_v2', {
          url: '/search_page_v2',
          templateUrl: 'home_page_v2/search_page_v2/partial_search_page_v2.html',
          controller: 'SearchPageV2Ctrl'
      })
      .state('home_page_v2.cart_page_v2', {
          url: '/cart_page_v2',
          templateUrl: 'home_page_v2/cart_page_v2/partial_cart_page_v2.html',
          controller: 'CartPageV2Ctrl'
      })
      .state('home_page_v2.swipe_page_v2', {
          url: '/swipe_page_v2',
          views: {
            '': {
              // This guy is the parent. He has things that the address view and
              // the stack view need to share with each other.
              templateUrl: 'home_page_v2/swipe_page_v2/partial_swipe_page_v2.html',
              controller: 'PartialSwipePageV2Ctrl',
            },
            'choose_address_v3@home_page_v2.swipe_page_v2': {
              templateUrl: ('home_page_v2/swipe_page_v2/' +
                            'choose_address_v3/choose_address_v3.html'),
              controller: 'ChooseAddressV3Ctrl'
            },
            'stack_v2@home_page_v2.swipe_page_v2': {
              templateUrl: ('home_page_v2/swipe_page_v2/' +
                            'stack_v2/stack_v2.html'),
              controller: 'StackV2Ctrl',
            }
          }
      });
  }]).
  run(['$rootScope', 'fmaSharedState', '$ionicPlatform', function($rootScope, fmaSharedState, $ionicPlatform) {
    ga_id = fmaSharedState.ga_id;
    window.analytics = {
      trackEvent: function (cat, str) {
        console.log('Tried to track event but not loaded yet: ' + cat + ' ' + str);
      },
      trackView: function() {
        console.log('Tried to track view but not loaded yet.');
      },
      trackTiming: function() {
        console.log('Tried to track timing but not loaded yet.');
      },
      addTransaction: function() {
        console.log('Adding transaction!');
      },
      addTransactionItem: function() {
        console.log('Adding transaction ITEM!');
      },
    };

  }]);
};

var app = {
    // Application Constructor
    initialize: function() {
      this.bindEvents();

      //Set up the main app module and pull in all the dependencies.
      initAngularStuff();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function() {
        app.receivedEvent('deviceready');
    },
    // Update DOM on a Received Event
    receivedEvent: function(id) {
      console.log('Received Event: ' + id);
      setTimeout(function() {
        navigator.splashscreen.hide();
      }, 600);
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(false);
      window.alert = function (txt) {
          navigator.notification.alert(txt, function(){
          }, "Burgie says..", "hush, burgie");
      };
      window.confirm = function(txt, callback) {
        navigator.notification.confirm(
          txt,   // message
          callback,    // callback to invoke with index of button pressed
          'Burgie wants to know..',           // title
          ['Sounds chill.', "No thanks, I hate food."]         // buttonLabels
        );
        return ret;
      };
      // The ga_id is set in intitAngular
      window.analytics.startTrackerWithId(ga_id);
      //window.analytics.debugMode();

      // If we're on Android, we need special css because of webkit bugs.
      document.body.className = device.platform.toLowerCase();
    }
};
