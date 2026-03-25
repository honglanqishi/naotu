pipeline {
    agent any
    
    environment {
        // SERVER_IP 可以在 Jenkins 全局凭据中配置，或直接写死
        SERVER_IP = "107.172.30.242"
        DEPLOY_USER = "root" // 请替换为实际的服务器 SSH 用户名
    }

    stages {
        stage('Deploy to Server') {
            steps {
                script {
                    // 使用 sshagent 插件进行部署
                    // 请在 Jenkins -> Manage Jenkins -> Credentials 中添加你的 SSH 私钥
                    // 将 credentialsId 替换为您在 Jenkins 里保存私钥的 ID
                    sshagent(['your-ssh-credential-id']) {
                        sh """
                            ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${SERVER_IP} '
                                # 进入项目目录（请替换为服务器上的实际路径）
                                cd /root/naotu || exit 1
                                
                                # 拉取最新代码
                                git pull origin main
                                
                                # 重新构建并平滑重启服务
                                docker-compose build
                                docker-compose up -d
                                
                                # 清理悬空镜像，释放磁盘空间
                                docker image prune -f
                            '
                        """
                    }
                }
            }
        }
    }
}
