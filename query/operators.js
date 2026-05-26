function eq(val) { return val; }
function gt(val) { return { $gt: val }; }
function gte(val) { return { $gte: val }; }
function lt(val) { return { $lt: val }; }
function lte(val) { return { $lte: val }; }
function ne(val) { return { $ne: val }; }
function matches(val) { return { $in: val }; }
function nin(val) { return { $nin: val }; }

module.exports = {
    eq,
    gt,
    gte,
    lt,
    lte,
    ne,
    matches,
    nin,
};
