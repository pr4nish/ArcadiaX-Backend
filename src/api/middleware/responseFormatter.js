/**
 * Standard API response formatter middleware
 * Ensures 100% consistent JSON contract across all routes:
 * Success: { success: true, data: ..., message: ... }
 * Error:   { success: false, error: ..., code: ..., details: ... }
 */
function responseFormatter(req, res, next) {
  res.success = (data = {}, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      data,
      message
    });
  };

  res.error = (message = 'An error occurred', statusCode = 400, code = 'BAD_REQUEST', details = null) => {
    return res.status(statusCode).json({
      success: false,
      error: message,
      code,
      details
    });
  };

  next();
}

module.exports = responseFormatter;
