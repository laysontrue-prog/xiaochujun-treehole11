module.exports = {
  apps: [{
    name: "student-treehole",
    script: "./server.js",
    instances: "max", // 利用所有CPU核心
    exec_mode: "cluster", // 集群模式
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
    }
  }]
};