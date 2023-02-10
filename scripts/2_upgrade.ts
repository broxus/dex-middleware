const main = async () => {
  const { code } = locklift.factory.getContractArtifacts("DexMiddleware");
  console.log(code);
};

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
