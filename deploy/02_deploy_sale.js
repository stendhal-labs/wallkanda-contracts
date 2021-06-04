// deploy/00_deploy_my_contract.js
module.exports = async ({ getNamedAccounts, deployments, ethers }) => {
    const { deploy, execute } = deployments;

    const { deployer } = await getNamedAccounts();

    const TransferProxy = await deployments.get('TransferProxy');

    const deployResult = await deploy('Exchange', {
        from: deployer,
        proxy: {
            proxyContract: 'OpenZeppelinTransparentProxy',
            methodName: 'initialize',
        },
        args: [
            process.env.SERVICE_FEE_BENEFICIARY,
            TransferProxy.address,
            process.env.BUYER_FEE,
            process.env.SELLER_FEE,
        ],
        log: true,
    });

    await execute(
        'TransferProxy',
        { from: deployer, log: true },
        'addOperators',
        [deployResult.address],
    );
};
module.exports.tags = ['Exchange'];
