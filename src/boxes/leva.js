export default {
  name: "Level Assignment Box",

  // TODO
  parser(reader) {
    const version = reader.bytesToInt(1);
    const flags = reader.bytesToInt(3);

    // ...

    return {
      version,
      flags,
    };
  },
};
