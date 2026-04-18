const { getDeploymentMode, isSaas } = require('../config/deployment.config');

const getDeploymentConfig = async (req, res) => {
  try {
    res.status(200).json({
      data: {
        deploymentMode: getDeploymentMode(),
        mostrarPlanesPublicos: isSaas()
      }
    });
  } catch (error) {
    console.error('getDeploymentConfig:', error);
    res.status(500).json({ message: 'Error' });
  }
};

module.exports = {
  getDeploymentConfig
};
