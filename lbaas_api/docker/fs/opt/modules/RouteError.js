/**
 * Copyright 2015 ARRIS Enterprises, Inc. All rights reserved.
 * This program is confidential and proprietary to ARRIS Enterprises, Inc. (ARRIS),
 * and may not be copied, reproduced, modified, disclosed to others, published or used,
 * in whole or in part, without the express prior written permission of ARRIS.
 */

/**
 * This module defines the AppInstallError
 */

/**
 * Import modules
 */
var appLogger = require('../utils/app_logger');

/**
 * Module class definition 
 */
module.exports = function(code, message) 
{
  appLogger.info("RouteError.enter, code=" + code + ", message= " + message);
  this.code = code;
  this.message = message;
  this.prototype = Error.prototype;
  appLogger.info("RouteError.exit"); 
}
