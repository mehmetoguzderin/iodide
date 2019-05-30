import { get, isString } from "lodash";
import {
  serializeChildSummary,
  serializeArrayPathsForRange,
  serializeSetIndexPathsForRange,
  serializeObjectPropsPathsForRange,
  serializeStringSummaryForRange
} from "./child-summary-serializer";
import { MAX_SUMMARY_STRING_LEN } from "./value-summary-serializer";
import {
  ChildSummary,
  ChildSummaryItem,
  RangeDescriptor
} from "./rep-serialization-core-types";
import { splitIndexRange, RANGE_SPLIT_THRESHOLD } from "./split-index-range";

export function expandRangesInChildSummaries(childSummaries) {
  // console.log("expandRangesInChildSummaries", childSummaries);
  const { childItems, summaryType } = childSummaries;
  const finalSubpaths = [];
  for (const summaryItem of childItems) {
    if (summaryItem.summary !== null) {
      // this is a valueSummary, and does not need to be split
      finalSubpaths.push(summaryItem);
    } else {
      // summaryItem.path is a RangeDescriptor; may need to be split
      const rangeDescriptors = splitIndexRange(summaryItem.path);
      // append all the resulting sub-ranges
      for (const rangeSummary of rangeDescriptors) {
        finalSubpaths.push(new ChildSummaryItem(rangeSummary, null));
      }
    }
  }

  return new ChildSummary(finalSubpaths, summaryType);
}

function getIteratorAtIndex(iterator, index) {
  // this is inefficient, but required for dealing with maps,
  // which don't allow lookup by index
  let i = 0;
  for (const item of iterator) {
    if (i === index) return item;
    i += 1;
  }
}

function getObjAtPath(baseObj, repPath) {
  const queryPath = repPath.filter(p => !(p instanceof RangeDescriptor));

  let obj = baseObj;
  let index = 0;
  const { length } = queryPath;

  while (obj != null && index < length) {
    const pathElt = queryPath[index];
    if (obj instanceof Map) {
      console.log("GETTING MAP PATH");
      // figure out the index of the key/val pair in map.entries()
      if (!isFinite(pathElt)) {
        throw new TypeError(
          "immediate subpaths of a map must be numeric entries index"
        );
      }
      const mapEntryIndex = pathElt;
      // then immediately advance down the path to see if this key or a value
      index += 1;
      const keyOrVal = queryPath[index];
      if (keyOrVal !== "MAP_KEY" && keyOrVal !== "MAP_VAL") {
        throw new TypeError(
          "paths into a map object must have MAP_KEY or MAP_VAL after the index into map.entries"
        );
      }
      console.log("GETTING MAP PATH, obj pre lookup:", obj);

      obj =
        keyOrVal === "MAP_KEY"
          ? getIteratorAtIndex(obj.keys(), Number(mapEntryIndex))
          : getIteratorAtIndex(obj.values(), Number(mapEntryIndex));
      console.log("GETTING MAP PATH, obj:", obj);
    } else {
      obj = obj[pathElt];
    }
    index += 1;
  }
  return obj;
}

export function getChildSummary(rootObjName, path, compact = true) {
  // console.log("getChildSummary(rootObjName, path,", rootObjName, path);
  const pathEnd = path[path.length - 1];
  if (isString(pathEnd)) {
    // if the last item in the path is a string,
    // serialize the object at the end of the path, dropping
    // non-string path elements (which are indexRanges)
    const childSummaries = serializeChildSummary(
      getObjAtPath(window[rootObjName], path.filter(isString))
    );
    // if (compact !== true) {
    //   // in this case, split up long RangeDescriptors
    //   return expandRangesInChildSummaries(childSummaries);
    // }
    return childSummaries;
  }
  // if the end of the path is not a string, it must be an RangeDescriptor.
  // Either break it up appropriately, or return the data for that range
  const { min, max, type } = pathEnd;
  const rangeSize = max - min;
  if (type === "STRING_RANGE" && rangeSize > MAX_SUMMARY_STRING_LEN) {
    // console.log("SPLITTING STRING RANGE", pathEnd);
    return new ChildSummary(
      splitIndexRange(pathEnd, MAX_SUMMARY_STRING_LEN).map(
        range => new ChildSummaryItem(range, null)
      ),
      "STRING_DESCRIPTOR_SUBRANGES"
    );
  } else if (type !== "STRING_RANGE" && rangeSize > RANGE_SPLIT_THRESHOLD) {
    // console.log("SPLITTING other RANGE", pathEnd);
    // if this range is too big, expand into subranges

    const tempChildSummariesForExpansion = new ChildSummary(
      [new ChildSummaryItem(pathEnd, null)],
      "RANGE_DESCRIPTOR_SUBRANGES"
    );

    return expandRangesInChildSummaries(tempChildSummariesForExpansion);
  }

  // ELSE: if it's not too big, get the summary for this range
  switch (type) {
    case "ARRAY_RANGE":
      return new ChildSummary(
        serializeArrayPathsForRange(
          get(window[rootObjName], path.filter(isString)),
          min,
          max
        ),
        "ARRAY_PATHS_FOR_RANGE"
      );

    case "PROPS_RANGE":
      return new ChildSummary(
        serializeObjectPropsPathsForRange(
          get(window[rootObjName], path.filter(isString)),
          min,
          max
        ),
        "OBJ_PROPS_PATHS_FOR_RANGE"
      );
    case "SET_INDEX_RANGE":
      return new ChildSummary(
        serializeSetIndexPathsForRange(
          get(window[rootObjName], path.filter(isString)),
          min,
          max
        ),
        "SET_INDEX_PATHS_FOR_RANGE"
      );
    case "STRING_RANGE":
      return new ChildSummary(
        serializeStringSummaryForRange(
          get(window[rootObjName], path.filter(isString)),
          min,
          max
        ),
        "STRING_SUMMARY_FOR_RANGE"
      );
    default:
      throw new TypeError(
        `invalid range type: ${JSON.stringify({
          type
        })}; pathEnd: ${JSON.stringify({
          pathEnd
        })}`
      );
  }
}