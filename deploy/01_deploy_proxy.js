// deploy/00_deploy_my_contract.js
module.exports = async ({ getNamedAccounts, deployments, ethers }) => {
    const { deploy, execute } = deployments;

    const { deployer } = await getNamedAccounts();

    let TransferProxy;
    try {
        TransferProxy = await deployments.get('TransferProxy');
    } catch (e) {}

    if (!TransferProxy) {
        await deploy('TransferProxy', {
            from: deployer,
            proxy: {
                proxyContract: 'OpenZeppelinTransparentProxy',
                methodName: 'initialize',
            },
            log: true,
        });
    }
};
module.exports.tags = ['TransferProxy'];
