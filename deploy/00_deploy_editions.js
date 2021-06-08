// deploy/00_deploy_my_contract.js
module.exports = async ({ getNamedAccounts, deployments, ethers }) => {
    const { deploy, execute } = deployments;

    const { deployer } = await getNamedAccounts();

    // verify if we already have a version deployed.
    // if not, we do a initialize deployment
    let Editions;

    try {
        Editions = await deployments.get('EditionsRegistry');
    } catch (e) {}

    if (!Editions || !Editions.address) {
        const deployResult = await deploy('EditionsRegistry', {
            from: deployer,
            proxy: {
                proxyContract: 'OpenZeppelinTransparentProxy',
                methodName: 'initialize',
            },
            args: [
                process.env.EDITIONS_URI,
                process.env.MINTER_ADDRESS,
                process.env.CONTRACT_URI,
                process.env.OPENSEA_REGISTRY,
            ],
            log: true,
        });

        await execute(
            'EditionsRegistry',
            { from: deployer, log: true },
            'setBaseURI',
            process.env.EDITIONS_URI.replace(
                '{contract}',
                deployResult.address.toLowerCase(),
            ),
        );
    } else {
        const deployResult = await deploy('EditionsRegistry', {
            from: deployer,
            proxy: {
                proxyContract: 'OpenZeppelinTransparentProxy',
            },
            log: true,
        });
    }
};
module.exports.tags = ['EditionsRegistry'];
