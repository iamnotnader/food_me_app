angular.module('foodmeApp.localStorage', [])

.factory('fmaLocalStorage', ['$window', function($window) {
  var getFunc = function(key, defaultValue) {
    return $window.localStorage[key] || defaultValue;
  };
  var getObjectFunc =  function(key) {
    var value = JSON.parse($window.localStorage[key] || '{}');
    if (value == null) {
      return {};
    }
    console.log(value);
    if (value.expirationTime != null &&
        (new Date().getTime() > new Date(value.expirationTime).getTime())) {
      return {};
    }
    return value;
  };
  return {
    set: function(key, value) {
      $window.localStorage[key] = value;
    },
    get: getFunc,
    setObject: function(key, value) {
      $window.localStorage[key] = JSON.stringify(value);
    },
    setObjectWithExpirationSeconds: function(key, value, secondsUntilExpiration) {
      var now = new Date();
      now.setUTCSeconds(now.getUTCSeconds() + secondsUntilExpiration);
      value.expirationTime = now;
      console.log('set: ' + secondsUntilExpiration);
      console.log(value);
      $window.localStorage[key] = JSON.stringify(value);
    },
    getObject: getObjectFunc,
    isSet: function(key) {
      return !_.isEmpty(getObjectFunc(key));
    }
  };
}]);
