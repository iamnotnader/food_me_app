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
    'ngAnimate',
    'ui.router',
    'ngIOS9UIWebViewPatch',
    'foodMeApp.introScreen',
    'foodMeApp.homePage',
    'foodMeApp.swipePage',
    'foodMeApp.searchPage',
    'foodMeApp.recentOrdersPage',
    'foodMeApp.cartPage',
    'foodMeApp.chooseCard',
    'foodmeApp.sharedState',
    'foodMeApp.chooseAddressV2',
    'foodMeApp.accountsPage',
    'foodMeApp.addCard',
    'foodMeApp.addPhone',
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
      .state('cart_page', {
          url: '/cart_page',
          templateUrl: 'cart_page/cart_page.html',
          controller: 'CartPageCtrl'
      })
      .state('choose_address_v2', {
          url: '/choose_address_v2',
          templateUrl: 'choose_address_v2/choose_address_v2.html',
          controller: 'ChooseAddressV2Ctrl'
      })
      .state('home_page', {
          url: '/home_page',
          templateUrl: 'home_page/home_page_partial.html',
          controller: 'HomePageCtrl'
      })
      .state('home_page.swipe_page', {
          url: '/swipe_page',
          templateUrl: 'home_page/swipe_page.html',
          controller: 'SwipePageCtrl'
      })
      .state('home_page.search_page', {
          url: '/search_page',
          templateUrl: 'home_page/search_page.html',
          controller: 'SearchPageCtrl'
      })
      .state('home_page.recent_orders', {
          url: '/recent_orders',
          templateUrl: 'home_page/recent_orders.html',
          controller: 'RecentOrdersPageCtrl'
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
      });
  }]).
  run(['$rootScope', 'fmaSharedState', function($rootScope, fmaSharedState) {
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
      setTimeout(function () {
        navigator.splashscreen.hide();
      }, 1500);
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
