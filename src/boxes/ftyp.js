export default {
  name: "File Type Box",
  description: "File type and compatibility",
  content: [
    {
      /* name: "major brand", */ // optional name
      key: "major_brand",
      description: "Brand identifier.",
    },
    {
      key: "minor_version",
      description: "informative integer for the minor version of the major brand",
    },
    {
      key: "compatible_brands",
      description: "List of brands",
    },
  ],

  parser(reader) {
    const len = reader.getTotalLength();
    const major_brand = reader.bytesToASCII(4);
    const minor_version = reader.bytesToInt(4);

    const compatArr = [];
    for (let i = 8; i < len; i+=4) {
      compatArr.push(reader.bytesToASCII(4));
    }

    return {
      major_brand,
      minor_version,
      compatible_brands: compatArr.join(", "),
    };
  },
};
