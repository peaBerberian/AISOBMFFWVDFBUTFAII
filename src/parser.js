import { be4toi, be8toi, be4toa } from "./utils/bytes.js";
import BufferReader from "./utils/buffer_reader.js";

import definitions from "./boxes";

const parseBoxes = (arr) => {
  let i = 0;
  const returnedArray = [];

  while ( i < arr.length) {
    let currentOffset = i;

    let size = be4toi(arr, currentOffset);
    currentOffset += 4;

    if (size === 1) {
      size = be8toi(arr, currentOffset);
      currentOffset += 8;
    } else if (size === 0) {
      size = arr.length - i;
    }

    const name = be4toa(arr, currentOffset);
    currentOffset += 4;

    const atomObject = {
      alias: name,
      size,
      values: [],
    };

    if (name === "uuid") {
      const subtype = [];
      let j = 16;
      while(j--) {
        subtype.push(arr[currentOffset]);
        currentOffset +=1;
      }

      atomObject.subtype = subtype;
    }

    returnedArray.push(atomObject);

    if (definitions[name]) {
      const config = definitions[name];
      const contentInfos = config.content ?
        config.content.reduce((acc, el) => {
          acc[el.key] = {
            name: el.name || "",
            description: el.description | "",
          };
          return acc;
        }, {}) : { name: "", description: "" };

      atomObject.name = config.name || "";
      atomObject.description = config.description || "";
      const hasChildren = !!config.container;

      const content = arr.slice(currentOffset, size + i);
      let contentForChildren;

      if (typeof config.parser === "function") {
        const parserReader = BufferReader(content);
        let result = {};
        try {
          result = config.parser(parserReader);
        } catch (e) {
          console.warn(`impossible to parse "${name}" box.`, e);
        }

        if (hasChildren) {
          const remaining = parserReader.getRemainingLength();
          contentForChildren = content.slice(content.length - remaining);
        } else if (!parserReader.isFinished()) {
          console.warn("not everything has been parsed for box: " + name +
            ". Missing", parserReader.getRemainingLength(), "bytes.");
        }

        delete result.__data__;
        Object.keys(result).forEach((key) => {
          const infos = contentInfos[key] || {};

          if (!infos.name) {
            infos.name = key;
          }

          atomObject.values.push(Object.assign({
            value: result[key],
          }, infos));
        });
      }

      if (hasChildren) {
        const childrenResult = parseBoxes(contentForChildren || content);
        atomObject.children = childrenResult;
      }
    }
    i += size;
  }

  return returnedArray;
};

export default parseBoxes;
