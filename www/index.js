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

var setupAnalytics = function(analytics_id) {
  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
  })(window,document,'script','//www.google-analytics.com/analytics.js','ga');

  ga('create', analytics_id, 'auto');
  ga('set', {
    page: '/init',
    title: 'Initializing the app.'
  });
  ga('send', 'pageview');
}

//Set up the main app module and pull in all the dependencies.
var initAngularStuff = function() {
  // Declare app level module which depends on views, and components
  console.log('Engaging angular.');
  angular.module('foodMeApp', [
    'ngRoute',
    'ngAnimate',
    'foodMeApp.dummyAppScreen',
    'foodMeApp.introScreen',
    'foodMeApp.chooseAddress',
    'foodMeApp.addAddress',
    'foodMeApp.chooseCuisine',
    'foodMeApp.swipePage',
    'foodMeApp.cartPage',
    'foodMeApp.chooseCard',
    'foodmeApp.sharedState',
  ]).
  config(['$routeProvider',
      function($routeProvider) {
    $routeProvider
      .otherwise({redirectTo: '/intro_screen'});
  }]).
  run(['$rootScope', 'fmaSharedState', function($rootScope, fmaSharedState) {
    setupAnalytics(fmaSharedState.ga_id);
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
    }
};
