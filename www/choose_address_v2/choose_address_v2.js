angular.module('foodMeApp.chooseAddressV2', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/choose_address_v2', {
    templateUrl: 'choose_address_v2/choose_address_v2.html',
    controller: 'ChooseAddressV2Ctrl'
  });
}])

.controller('ChooseAddressV2Ctrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$rootScope", "$timeout",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $rootScope, $timeout) {
  var mainViewObj = $('#main_view_container');

  analytics.trackView('/choose_address_v2');
  $scope.recentAddresses = fmaLocalStorage.getObject('recentAddresses');
  if ($scope.recentAddresses == null) {
    $scope.recentAddresses = [];
  }

  $scope.userAddress = null;
  function initAutocomplete() {
    // Create the autocomplete object, restricting the search to geographical
    // location types.
    autocomplete = new google.maps.places.Autocomplete(
        /** @type {!HTMLInputElement} */(document.getElementById('choose_address_v2__autocomplete')),
        {
          types: ['address'],
          componentRestrictions: { country: "us" }
        });

    // When the user selects an address from the dropdown, populate the address
    // fields in the form.
    autocomplete.addListener('place_changed', fillInAddress);
  }

  var addressToString = function(address) {
    return address.street + ' ' + address.city + ', '
        + address.state + ' ' + address.zip_code
  }

  function fillInAddress() {
    // Get the place details from the autocomplete object.
    var place = autocomplete.getPlace();

    components = place.formatted_address.split(',')
    if (components.length < 4 || components[2].split(' ').length < 3) {
      console.log('WTF! Couldn\'t parse address...');
      alert('I had trouble parsing that address-- could you try ' +
            'a slightly different one?');
      return;
    }
    components[2] = components[2].split(' ');
    $scope.userAddress = {
      street: components[0],
      city: components[1],
      state: components[2][1],
      zip_code: components[2][2],
      phone: null,
      unit_number: null,
    };
    console.log($scope.userAddress);
    
    $scope.$apply(function() {
      $scope.query = addressToString($scope.userAddress);
      $scope.selectedLocationIndex = { value: null };
    });
  }

  // Bias the autocomplete object to the user's geographical location,
  // as supplied by the browser's 'navigator.geolocation' object.
  // Called in the input field.
  function geolocate() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        var geolocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        var circle = new google.maps.Circle({
          center: geolocation,
          radius: position.coords.accuracy
        });
        autocomplete.setBounds(circle.getBounds());
      });
    }
  }

  $scope.inputChanged = function(query) {
    $scope.userAddress = null;
    navigator.geolocation.getCurrentPosition(function(locSucc) {
      var lattitude = locSucc.coords.latitude;
      var longitude = locSucc.coords.longitude;
      $http.get('https://maps.googleapis.com/maps/api/geocode/json?latlng='+lattitude+','+longitude)
      .then(
        function(res) {
          // Pump formatted_address into autocomplete and use that.
          console.log(res.data.results[0].formatted_address);
          debugger;
        },
        function(err) {
          debugger;
        }
      );
    },
    function(locErr) {
      console.log('ERROR WITH LOCATION');
    });
                             //[geolocationError],
                                         //[geolocationOptions]);
  };

  $scope.clearTextPressed = function() {
    $scope.query = '';
  };

  $scope.selectedLocationIndex = { value: null };
  $scope.cellSelected = function(addressIndex) {
    $scope.selectedLocationIndex.value = addressIndex;
    $scope.userAddress = $scope.recentAddresses[addressIndex];
    $scope.query = addressToString($scope.userAddress);
  }

  $scope.doneButtonPressed = function() {
    analytics.trackEvent('nav', 'choose_address_v2__done_pressed');
    console.log('Done button pressed.');
    if ($scope.userAddress == null) {
      console.log('No address entered yet.');
      alert('Tell us where you live, bro.');
      return;
    }
    console.log('Saving address.');
    // Save the address.
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userAddress', $scope.userAddress,
        fmaSharedState.testing_invalidation_seconds);

    // Add the address to the recent addresses.
    var addressIsNew = true;
    for (var v1 = 0; v1 < $scope.recentAddresses.length; v1++) {
      var locationObj = $scope.recentAddresses[v1];
      if (angular.equals(locationObj, $scope.userAddress)) {
        addressIsNew = false;
        break;
      }
    }
    if (addressIsNew) {
      $scope.recentAddresses = [$scope.userAddress,].concat($scope.recentAddresses.slice(0, 4));
      fmaLocalStorage.setObjectWithExpirationSeconds(
          'recentAddresses', $scope.recentAddresses,
          fmaSharedState.testing_invalidation_seconds);
    }
    $location.path('/choose_cuisine');
    return;
  };

  // Init some things.
  initAutocomplete();
}]);
