export const RolePermissions = {
    admin: [
        'admin.dashboard',
        'admin.agents.manage',
        'admin.users.manage',
        'system.settings',
        'system.status.manage'
    ],
    agent: [
        'agent.dashboard',
        'agent.users.manage',
        'agent.history.view'
    ],
    user: [
        'user.play',
        'user.history.view',
        'user.profile.view'
    ]
};
