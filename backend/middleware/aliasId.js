// aliasId.js
// Middleware that adds _id = id to every object in the response body's `data` field.
// This keeps full backward-compatibility with the React frontend which expects _id
// (the MongoDB convention), while Prisma returns `id`.
//
// Works recursively — handles nested relations (booking.court, booking.coach, etc.)
// Skips Date objects, null, and primitives.
// Only adds _id when the object has `id` and does not already have `_id`.

function aliasItem(item) {
  // Skip primitives, null, Date instances, and arrays (handled by aliasData)
  if (!item || typeof item !== 'object' || item instanceof Date || Buffer.isBuffer(item)) {
    return item;
  }

  // Spread to plain object first (handles Prisma result objects cleanly)
  const result = { ...item };

  // Add _id alias when id exists and _id is not already set
  if ('id' in result && !('_id' in result)) {
    result._id = result.id;
  }

  // Recurse into nested fields
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (!val || typeof val !== 'object' || val instanceof Date || Buffer.isBuffer(val)) continue;

    if (Array.isArray(val)) {
      result[key] = val.map(aliasItem);
    } else {
      result[key] = aliasItem(val);
    }
  }

  return result;
}

function aliasData(data) {
  if (Array.isArray(data)) return data.map(aliasItem);
  if (data && typeof data === 'object') return aliasItem(data);
  return data;
}

module.exports = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    if (body && typeof body === 'object' && 'data' in body) {
      body = { ...body, data: aliasData(body.data) };
    }
    return originalJson(body);
  };

  next();
};
