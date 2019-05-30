// THIS FILE MUST NOT IMPORT ANYTHING.
// (We don't want it to get caught in import circularities)

// These are just a container classes to clarify semantics and
// to clarify code by not putting plain objects everywhere.
// All of these containers need to be serializable, so they
// should not have methods beyond getters -- no internal state
// or internal state mutation.
// They are really basically to be used as type definitions,
// since the rep serialization machinery benefits from precise types.

// one day we'll move to type script and replace all this with interfaces or whatever.

const nonExpandableTypes = ["Function", "GeneratorFunction", "Date", "RegExp"];

export class ValueSummary {
  // Contains top-level summary info about an object/value,
  // but without info about child objects.
  // This info is sufficient to produce a "tiny rep"
  constructor(objType, size, stringValue, isTruncated) {
    this.objType = objType; // string
    this.size = size; // number
    this.stringValue = stringValue; // string
    this.isTruncated = isTruncated; // bool
  }

  get isExpandable() {
    if (nonExpandableTypes.includes(this.objType)) return false;

    if (this.objType === "String") return this.isTruncated;

    return this.size > 0;
  }
}

export class RangeDescriptor {
  // Describes a range of indices among the children of an object.
  // IMPORTANT: these ranges are INCLUSIVE of their endpoints.
  constructor(min, max, type = "ARRAY_RANGE") {
    if (max < min) {
      // note: can technically be equal since the ranges are inclusive
      throw new TypeError(
        `invalid input to RangeDescriptor ${JSON.stringify({
          max,
          min,
          type
        })}`
      );
    }
    this.min = min; // numeric, required
    this.max = max; // numeric, required
    this.type = type;
  }
}

export class ChildSummary {
  // an instance of this class summarizes information about the children
  // of an object. These can be either values or ranges of indices.
  constructor(childItems, summaryType) {
    this.childItems = childItems; // array of ChildSummaryItems
    this.summaryType = summaryType; // string
  }
}

export class ChildSummaryItem {
  // an item in a ChildSummary. Contains
  // (1) a path, which can be a a key in an object, or a
  // RangeDescriptor to narrow in on a range
  // (2) a summary, which is null IFF the path is a RangeDescriptor
  constructor(path, summary) {
    this.path = path; // String or RangeDescriptor
    this.summary = summary; // ValueSummary or null
  }
}

export class SubstringRangeSummaryItem extends ChildSummaryItem {
  // a SubstringRangeSummaryItem always has `path` of class
  // RangeDescriptor and `summary` of class ValueSummary.
  // In this case, the ValueSummary is a substring of the
  // parent string
  constructor(path, summary) {
    super();
    this.path = path; // RangeDescriptor
    this.summary = summary; // ValueSummary
  }
}

export class MapPairSummaryItem extends ChildSummaryItem {
  constructor(mapEntryIndex, keySummary, valSummary) {
    super();
    this.path = mapEntryIndex; // int
    this.keySummary = keySummary; // ValueSummary
    this.valSummary = valSummary; // ValueSummary
  }
}

// export class MapKeyPathItem {
//   constructor(mapEntryIndex, summary) {
//     super();
//     this.path = mapEntryIndex,
//       this.summary = summary; // ValueSummary
//   }
// }

// export class MapKeyPathItem {
//   constructor(mapEntryIndex, summary) {
//     super();
//     this.path = mapEntryIndex,
//     this.summary = summary; // ValueSummary
//   }
// }
// export class MapPathItem {
//   constructor(mapEntryIndex, keyOrVal, summary) {
//     super();
//     this.path = mapEntryIndex,
//     this.keyOrVal = keyOrVal//
//     this.summary = summary; // ValueSummary
//   }
// }

// export class MapKeySummaryItem extends ChildSummaryItem {
//   constructor(path, summary) {
//     super();
//     this.path = path; // MapKeyPathItem
//     this.summary = summary; // ValueSummary
//   }
// }