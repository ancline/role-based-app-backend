// ─── CONFIG ──────────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:3000/api';

// ─── STATE ───────────────────────────────────────────────────────────────────

let currentUser = null;

// ─── API HELPER ──────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...getAuthHeader(), ...options.headers };

    const res = await fetch(API_BASE + path, { ...options, headers });
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || 'Request failed');
    }
    return data;
}

// ─── AUTH STATE ──────────────────────────────────────────────────────────────

function setAuthState(isAuth, user) {
    if (isAuth && user) {
        currentUser = user;
    } else {
        currentUser = null;
        sessionStorage.removeItem('authToken');
    }

    if (isAuth) {
        document.body.classList.add('authenticated');
        document.body.classList.remove('not-authenticated');
    } else {
        document.body.classList.remove('authenticated');
        document.body.classList.add('not-authenticated');
    }

    if (user && user.isAdmin) {
        document.body.classList.add('is-admin');
    } else {
        document.body.classList.remove('is-admin');
    }

    updateNav(currentUser);
}

// ─── NAV ─────────────────────────────────────────────────────────────────────

function updateNav(user) {
    if (user) {
        document.getElementById('navButtons').classList.add('d-none');
        document.getElementById('navUser').classList.remove('d-none');

        if (user.isAdmin) {
            document.getElementById('navEmployeesLink').classList.remove('d-none');
            document.getElementById('navAccountsLink').classList.remove('d-none');
            document.getElementById('navDepartmentsLink').classList.remove('d-none');
        } else {
            document.getElementById('navEmployeesLink').classList.add('d-none');
            document.getElementById('navAccountsLink').classList.add('d-none');
            document.getElementById('navDepartmentsLink').classList.add('d-none');
        }

        const dd = document.getElementById('userDropdown');
        if (dd) dd.textContent = (user.isAdmin ? 'Admin ▼' : 'User ▼');
    } else {
        document.getElementById('navButtons').classList.remove('d-none');
        document.getElementById('navUser').classList.add('d-none');
        const dd = document.getElementById('userDropdown');
        if (dd) dd.textContent = 'Account ▼';
    }
}

// ─── ROUTING ─────────────────────────────────────────────────────────────────

function navigateTo(hash) {
    window.location.hash = hash;
}

function showPage(pageId) {
    navigateTo('#/' + pageId);
}

function handleRouting() {
    const hash = window.location.hash || '#/';
    const route = hash.replace('#/', '') || 'main';

    const protectedRoutes = ['dashboard', 'profile', 'requests'];
    const adminRoutes = ['employees', 'departments', 'accounts'];

    if (protectedRoutes.includes(route)) {
        if (!currentUser) { navigateTo('#/login'); return; }
    }

    if (adminRoutes.includes(route)) {
        if (!currentUser) { navigateTo('#/login'); return; }
        if (!currentUser.isAdmin) {
            alert('Access Denied: Admin privileges required');
            navigateTo('#/dashboard');
            return;
        }
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    const pageElement = document.getElementById(route);
    if (pageElement) {
        pageElement.classList.add('active');

        if (route === 'profile' && currentUser) renderProfile();
        if (route === 'dashboard' && currentUser) {
            document.getElementById('dashboardUserName').textContent =
                currentUser.firstName + ' ' + currentUser.lastName;
            document.getElementById('dashboardAdminLinks').classList.toggle('d-none', !currentUser.isAdmin);
        }
        if (route === 'employees' && currentUser && currentUser.isAdmin) {
            loadEmployees();
            loadDepartmentsDropdown();
        }
        if (route === 'departments' && currentUser && currentUser.isAdmin) loadDepartments();
        if (route === 'accounts' && currentUser && currentUser.isAdmin) loadAccounts();
        if (route === 'requests' && currentUser) loadRequests();
    } else {
        navigateTo('#/');
    }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

async function initApp() {
    const token = sessionStorage.getItem('authToken');
    if (token) {
        try {
            const data = await apiFetch('/profile');
            setAuthState(true, data.user);
        } catch {
            setAuthState(false);
        }
    } else {
        setAuthState(false);
    }

    if (!window.location.hash) window.location.hash = '#/';
    handleRouting();
}

window.addEventListener('hashchange', handleRouting);
initApp();

// ─── REGISTER ────────────────────────────────────────────────────────────────

async function handleRegister(event) {
    event.preventDefault();
    hideError('registerError');

    const body = {
        firstName: document.getElementById('regFirstName').value,
        lastName:  document.getElementById('regLastName').value,
        email:     document.getElementById('regEmail').value,
        password:  document.getElementById('regPassword').value
    };

    try {
        await apiFetch('/register', { method: 'POST', body: JSON.stringify(body) });
        document.getElementById('verifyEmailDisplay').textContent = body.email;
        sessionStorage.setItem('unverified_email', body.email);
        event.target.reset();
        navigateTo('#/verify');
    } catch (err) {
        showError('registerError', err.message);
    }
}

// ─── VERIFY ──────────────────────────────────────────────────────────────────

async function simulateVerification() {
    const email = sessionStorage.getItem('unverified_email') ||
                  document.getElementById('verifyEmailDisplay').textContent;
    try {
        await apiFetch('/verify', { method: 'POST', body: JSON.stringify({ email }) });
        sessionStorage.removeItem('unverified_email');
        navigateTo('#/login');
    } catch (err) {
        alert('Verification failed: ' + err.message);
    }
}

// ─── AUTH HEADER HELPER ──────────────────────────────────────────────────────

function getAuthHeader() {
    const token = sessionStorage.getItem('authToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// Example: Fetch admin data
async function loadAdminDashboard() {
    const res = await fetch('http://localhost:3000/api/admin/dashboard', {
        headers: getAuthHeader()
    });
    if (res.ok) {
        const data = await res.json();
        document.getElementById('content').innerText = data.message;
    } else {
        document.getElementById('content').innerText = 'Access denied!';
    }
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────

async function login(username, password) {
    let response;
    try {
        response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
    } catch (err) {
        // Only real network failures (offline, CORS, DNS) reach here
        alert('Network error');
        throw err;
    }

    const data = await response.json();

    if (response.ok) {
        // Save token in memory (or sessionStorage for page refresh)
        sessionStorage.setItem('authToken', data.token);
        setAuthState(true, data.user);
    } else {
        alert('Login failed: ' + data.error);
    } 

   
}

async function handleLogin(event) {
    event.preventDefault();

    let username, password, errorElement;

    if (event.target.closest('#login')) {
        username     = document.getElementById('loginEmail').value;
        password     = document.getElementById('loginPassword').value;
        errorElement = 'loginError';
    } else {
        username     = document.getElementById('verifiedEmail').value;
        password     = document.getElementById('verifiedPassword').value;
        errorElement = 'verifiedError';
    }

    hideError(errorElement);

    try {
        await login(username, password);
        event.target.reset();
        // Redirect based on role
        if (currentUser && currentUser.isAdmin) {
            navigateTo('#/dashboard');
        } else {
            navigateTo('#/profile');
        }
    } catch (err) {
        showError(errorElement, err.message);
    }
}

// ─── LOGOUT ──────────────────────────────────────────────────────────────────

function logout() {
    setAuthState(false);
    navigateTo('#/');
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────

function renderProfile() {
    if (!currentUser) return;
    document.getElementById('profileUserName').textContent =
        currentUser.firstName + ' ' + currentUser.lastName;
    document.getElementById('profileEmail').textContent = currentUser.email;
    document.getElementById('profileRole').textContent = currentUser.isAdmin ? 'Admin' : 'User';

    const btn = document.querySelector('#profile .btn-outline-primary');
    if (btn) {
        btn.onclick = showEditProfileModal;
        btn.classList.remove('d-none');
    }
}

function showEditProfileModal() {
    alert('Edit Profile clicked — modal not implemented yet.');
}

// ─── ERROR HELPERS ────────────────────────────────────────────────────────────

function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = message;
    el.classList.remove('d-none');
}

function hideError(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.classList.add('d-none');
}

// ─── EMPLOYEES ───────────────────────────────────────────────────────────────

async function loadEmployees() {
    const tbody = document.getElementById('employeesTableBody');
    try {
        const employees = await apiFetch('/employees');
        if (employees.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No employees.</td></tr>';
            return;
        }
        tbody.innerHTML = employees.map(emp => `
            <tr>
                <td>${emp.employeeId}</td>
                <td>${emp.email}</td>
                <td>${emp.position}</td>
                <td>${emp.department}</td>
                <td>
                    <button class="btn btn-primary btn-sm me-1" onclick="editEmployee('${emp.employeeId}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteEmployee('${emp.employeeId}')">Delete</button>
                </td>
            </tr>`).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">${err.message}</td></tr>`;
    }
}

function showAddEmployeeModal() {
    document.getElementById('employeeForm').reset();
    document.getElementById('employeeId').value = '';
    new bootstrap.Modal(document.getElementById('addEmployeeModal')).show();
}

async function editEmployee(employeeId) {
    try {
        const employees = await apiFetch('/employees');
        const employee = employees.find(e => e.employeeId === employeeId);
        if (employee) {
            document.getElementById('employeeId').value = employeeId;
            document.getElementById('employeeIdInput').value = employee.employeeId;
            document.getElementById('employeeEmail').value = employee.email;
            document.getElementById('employeePosition').value = employee.position;
            document.getElementById('employeeDepartment').value = employee.department;
            document.getElementById('employeeHireDate').value = employee.hireDate;
            new bootstrap.Modal(document.getElementById('addEmployeeModal')).show();
        }
    } catch (err) {
        alert('Error loading employee: ' + err.message);
    }
}

async function saveEmployee(event) {
    event.preventDefault();
    const oldId  = document.getElementById('employeeId').value;
    const employee = {
        employeeId: document.getElementById('employeeIdInput').value,
        email:      document.getElementById('employeeEmail').value,
        position:   document.getElementById('employeePosition').value,
        department: document.getElementById('employeeDepartment').value,
        hireDate:   document.getElementById('employeeHireDate').value
    };

    try {
        if (oldId) {
            await apiFetch(`/employees/${oldId}`, { method: 'PUT', body: JSON.stringify(employee) });
        } else {
            await apiFetch('/employees', { method: 'POST', body: JSON.stringify(employee) });
        }
        bootstrap.Modal.getInstance(document.getElementById('addEmployeeModal')).hide();
        loadEmployees();
    } catch (err) {
        alert('Error saving employee: ' + err.message);
    }
}

async function deleteEmployee(employeeId) {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    try {
        await apiFetch(`/employees/${employeeId}`, { method: 'DELETE' });
        loadEmployees();
    } catch (err) {
        alert('Error deleting employee: ' + err.message);
    }
}

async function loadDepartmentsDropdown() {
    const select = document.getElementById('employeeDepartment');
    try {
        const departments = await apiFetch('/departments');
        select.innerHTML = '<option value="">Select Department</option>' +
            departments.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    } catch {
        select.innerHTML = '<option value="">Could not load departments</option>';
    }
}

// ─── DEPARTMENTS ─────────────────────────────────────────────────────────────

async function loadDepartments() {
    const tbody = document.getElementById('departmentsTableBody');
    try {
        const departments = await apiFetch('/departments');
        if (departments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">No departments.</td></tr>';
            return;
        }
        tbody.innerHTML = departments.map(dept => `
            <tr>
                <td>${dept.name}</td>
                <td>${dept.description}</td>
                <td>
                    <button class="btn btn-outline-primary btn-sm me-1" onclick="editDepartment(${dept.id})">Edit</button>
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteDepartment(${dept.id})">Delete</button>
                </td>
            </tr>`).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger py-4">${err.message}</td></tr>`;
    }
}

function showAddDepartmentModal() {
    document.getElementById('departmentForm').reset();
    document.getElementById('departmentId').value = '';
    new bootstrap.Modal(document.getElementById('addDepartmentModal')).show();
}

async function editDepartment(id) {
    try {
        const departments = await apiFetch('/departments');
        const dept = departments.find(d => d.id === id);
        if (dept) {
            document.getElementById('departmentId').value = dept.id;
            document.getElementById('departmentName').value = dept.name;
            document.getElementById('departmentDescription').value = dept.description;
            new bootstrap.Modal(document.getElementById('addDepartmentModal')).show();
        }
    } catch (err) {
        alert('Error loading department: ' + err.message);
    }
}

async function saveDepartment(event) {
    event.preventDefault();
    const id = document.getElementById('departmentId').value;
    const department = {
        name:        document.getElementById('departmentName').value,
        description: document.getElementById('departmentDescription').value
    };

    try {
        if (id) {
            await apiFetch(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(department) });
        } else {
            await apiFetch('/departments', { method: 'POST', body: JSON.stringify(department) });
        }
        bootstrap.Modal.getInstance(document.getElementById('addDepartmentModal')).hide();
        loadDepartments();
    } catch (err) {
        alert('Error saving department: ' + err.message);
    }
}

async function deleteDepartment(id) {
    if (!confirm('Are you sure you want to delete this department?')) return;
    try {
        await apiFetch(`/departments/${id}`, { method: 'DELETE' });
        loadDepartments();
    } catch (err) {
        alert('Error deleting department: ' + err.message);
    }
}

// ─── ACCOUNTS ────────────────────────────────────────────────────────────────

async function loadAccounts() {
    const tbody = document.getElementById('accountsTableBody');
    try {
        const users = await apiFetch('/accounts');
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No accounts.</td></tr>';
            return;
        }
        tbody.innerHTML = users.map((user, i) => `
            <tr>
                <td>${user.firstName} ${user.lastName}</td>
                <td>${user.email}</td>
                <td><span class="badge bg-${user.isAdmin ? 'danger' : 'primary'}">${user.isAdmin ? 'Admin' : 'User'}</span></td>
                <td>${user.verified ? '<span class="text-success">✓</span>' : '<span class="text-muted">✗</span>'}</td>
                <td>
                    <div class="d-flex flex-column gap-1" style="width:120px;">
                        <button class="btn btn-outline-primary btn-sm" onclick="editAccount(${user.id})">Edit</button>
                        ${!user.isAdmin ? `<button class="btn btn-warning btn-sm" onclick="resetPassword(${user.id})">Reset Password</button>` : ''}
                        <button class="btn btn-outline-danger btn-sm" onclick="deleteAccount(${user.id})">Delete</button>
                    </div>
                </td>
            </tr>`).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">${err.message}</td></tr>`;
    }
}

function showAddAccountModal() {
    document.getElementById('accountForm').reset();
    document.getElementById('accountIndex').value = '';
    document.getElementById('accountPassword').setAttribute('required', 'required');
    new bootstrap.Modal(document.getElementById('addAccountModal')).show();
}

async function editAccount(id) {
    try {
        const users = await apiFetch('/accounts');
        const user  = users.find(u => u.id === id);
        if (user) {
            document.getElementById('accountIndex').value     = id;
            document.getElementById('accountFirstName').value = user.firstName;
            document.getElementById('accountLastName').value  = user.lastName;
            document.getElementById('accountEmail').value     = user.email;
            document.getElementById('accountPassword').value  = '';
            document.getElementById('accountPassword').removeAttribute('required');
            document.getElementById('accountRole').value      = user.isAdmin ? 'Admin' : 'User';
            document.getElementById('accountVerified').checked = user.verified;
            new bootstrap.Modal(document.getElementById('addAccountModal')).show();
        }
    } catch (err) {
        alert('Error loading account: ' + err.message);
    }
}

async function saveAccount(event) {
    event.preventDefault();
    const id = document.getElementById('accountIndex').value;

    const account = {
        firstName: document.getElementById('accountFirstName').value,
        lastName:  document.getElementById('accountLastName').value,
        email:     document.getElementById('accountEmail').value,
        role:      document.getElementById('accountRole').value.toLowerCase(),
        verified:  document.getElementById('accountVerified').checked
    };

    const password = document.getElementById('accountPassword').value;
    if (password) account.password = password;

    try {
        if (id) {
            await apiFetch(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(account) });
        } else {
            if (!password) { alert('Password is required for new accounts'); return; }
            await apiFetch('/accounts', { method: 'POST', body: JSON.stringify(account) });
        }
        bootstrap.Modal.getInstance(document.getElementById('addAccountModal')).hide();
        loadAccounts();
    } catch (err) {
        alert('Error saving account: ' + err.message);
    }
}

async function resetPassword(id) {
    const newPassword = prompt('Enter new password (min 6 characters):');
    if (!newPassword || newPassword.length < 6) return;
    try {
        await apiFetch(`/accounts/${id}/reset-password`, {
            method: 'POST',
            body: JSON.stringify({ password: newPassword })
        });
        alert('Password reset successfully!');
    } catch (err) {
        alert('Error resetting password: ' + err.message);
    }
}

async function deleteAccount(id) {
    if (currentUser && currentUser.id === id) {
        alert('You cannot delete your own account!');
        return;
    }
    if (!confirm('Are you sure you want to delete this account?')) return;
    try {
        await apiFetch(`/accounts/${id}`, { method: 'DELETE' });
        loadAccounts();
    } catch (err) {
        alert('Error deleting account: ' + err.message);
    }
}

// ─── REQUESTS ────────────────────────────────────────────────────────────────

async function loadRequests() {
    const emptyState = document.getElementById('requestsEmptyState');
    const table      = document.getElementById('requestsTable');
    const tbody      = document.getElementById('requestsTableBody');

    try {
        const requests = await apiFetch('/requests');
        if (requests.length === 0) {
            emptyState.classList.remove('d-none');
            table.classList.add('d-none');
            return;
        }

        emptyState.classList.add('d-none');
        table.classList.remove('d-none');

        tbody.innerHTML = requests.map(req => {
            const badgeClass = req.status === 'Approved' ? 'success' :
                               req.status === 'Rejected' ? 'danger' : 'warning';
            return `
                <tr>
                    <td>#${req.id}</td>
                    <td>${req.type}</td>
                    <td>${req.items.length} item(s)</td>
                    <td><span class="badge bg-${badgeClass}">${req.status}</span></td>
                    <td>${new Date(req.date).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="viewRequest(${req.id})">View</button>
                        ${req.status === 'Pending' ? `<button class="btn btn-danger btn-sm" onclick="deleteRequest(${req.id})">Delete</button>` : ''}
                    </td>
                </tr>`;
        }).join('');
    } catch (err) {
        emptyState.classList.remove('d-none');
        table.classList.add('d-none');
        emptyState.innerHTML = `<p class="text-danger">${err.message}</p>`;
    }
}

function showNewRequestModal() {
    document.getElementById('requestForm').reset();
    document.getElementById('requestItemsList').innerHTML = `
        <div class="input-group mb-2">
            <input type="text" class="form-control" placeholder="Item name" required>
            <input type="number" class="form-control" style="max-width:80px;" value="1" min="1">
            <button type="button" class="btn btn-outline-danger" onclick="removeRequestItem(this)">×</button>
        </div>`;
    new bootstrap.Modal(document.getElementById('newRequestModal')).show();
}

function addRequestItem() {
    const container = document.getElementById('requestItemsList');
    const newItem   = document.createElement('div');
    newItem.className = 'input-group mb-2';
    newItem.innerHTML = `
        <input type="text" class="form-control" placeholder="Item name" required>
        <input type="number" class="form-control" style="max-width:80px;" value="1" min="1">
        <button type="button" class="btn btn-outline-danger" onclick="removeRequestItem(this)">×</button>`;
    container.appendChild(newItem);
}

function removeRequestItem(button) {
    const container = document.getElementById('requestItemsList');
    if (container.children.length > 1) {
        button.closest('.input-group').remove();
    }
}

async function saveRequest(event) {
    event.preventDefault();
    const type  = document.getElementById('requestType').value;
    const items = [...document.getElementById('requestItemsList').querySelectorAll('.input-group')]
        .map(group => {
            const inputs = group.querySelectorAll('input');
            return { name: inputs[0].value, quantity: parseInt(inputs[1].value) };
        });

    try {
        await apiFetch('/requests', { method: 'POST', body: JSON.stringify({ type, items }) });
        bootstrap.Modal.getInstance(document.getElementById('newRequestModal')).hide();
        loadRequests();
    } catch (err) {
        alert('Error creating request: ' + err.message);
    }
}

async function viewRequest(id) {
    try {
        const requests = await apiFetch('/requests');
        const request  = requests.find(r => r.id === id);
        if (request) {
            const itemsList = request.items.map(i => `${i.name} (x${i.quantity})`).join(', ');
            alert(`Request #${request.id}\nType: ${request.type}\nItems: ${itemsList}\nStatus: ${request.status}\nDate: ${new Date(request.date).toLocaleString()}`);
        }
    } catch (err) {
        alert('Error loading request: ' + err.message);
    }
}

async function deleteRequest(id) {
    if (!confirm('Are you sure you want to delete this request?')) return;
    try {
        await apiFetch(`/requests/${id}`, { method: 'DELETE' });
        loadRequests();
    } catch (err) {
        alert('Error deleting request: ' + err.message);
    }
}