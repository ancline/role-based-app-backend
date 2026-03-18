
let currentUser = null;
const STORAGE_KEY = 'ipt_demo_v1';


window.db = window.db || {};



function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(window.db));
    } catch (e) {
        console.error('Failed to save to storage', e);
    }
}

function loadFromStorage() {
    try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) throw new Error('missing');
        var parsed = JSON.parse(raw);
        
        window.db.accounts = parsed.accounts || [];
        window.db.departments = parsed.departments || [];
        window.db.employees = parsed.employees || [];
        window.db.requests = parsed.requests || [];
    } catch (e) {
        
        window.db.accounts = [
            {
                firstName: 'Admin',
                lastName: 'User',
                email: 'admin@example.com',
                password: 'Password123!',
                verified: true,
                isAdmin: true,
                createdAt: new Date().toISOString()
            }
        ];
        window.db.departments = [
            { id: 1, name: 'Engineering', description: 'Software team' },
            { id: 2, name: 'HR', description: 'Human Resources' }
        ];
        window.db.employees = [];
        window.db.requests = [];
        saveToStorage();
    }
}


function setAuthState(isAuth, user) {
    if (isAuth && user) {
        currentUser = user;
        localStorage.setItem('auth_token', user.email);
        localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
        currentUser = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('currentUser');
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


function initStorage() {
    
    loadFromStorage();

    
    var authToken = localStorage.getItem('auth_token');
    if (authToken) {
        for (var i = 0; i < (window.db.accounts || []).length; i++) {
            if (window.db.accounts[i].email === authToken) {
                setAuthState(true, window.db.accounts[i]);
                break;
            }
        }
    } else {
        
        var storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            currentUser = JSON.parse(storedUser);
            updateNav(currentUser);
        }
    }
}


function navigateTo(hash) {
    window.location.hash = hash;
}


function handleRouting() {
    var hash = window.location.hash || '#/';
    var route = hash.replace('#/', '');
    
    if (!route) {
        route = 'main';
    }
    
    var protectedRoutes = ['dashboard', 'profile', 'requests'];
    var adminRoutes = ['employees', 'departments', 'accounts'];
    
    if (protectedRoutes.includes(route)) {
        if (!currentUser) {
            console.log('need to login first');
            navigateTo('#/login');
            return;
        }
    }
    
    
    if (adminRoutes.includes(route)) {
        if (!currentUser) {
            navigateTo('#/login');
            return;
        }
        if (!currentUser.isAdmin) {
            alert('Access Denied: Admin privileges required');
            navigateTo('#/dashboard');
            return;
        }
    }
    
    
    
    var pages = document.querySelectorAll('.page');
    for (var i = 0; i < pages.length; i++) {
        pages[i].classList.remove('active');
    }
    
    
    var pageElement = document.getElementById(route);
    if (pageElement) {
        pageElement.classList.add('active');
        
        
        if (route === 'profile' && currentUser) {
            renderProfile();
        }
        
        
        if (route === 'dashboard' && currentUser) {
            document.getElementById('dashboardUserName').textContent = currentUser.firstName + ' ' + currentUser.lastName;
            if (currentUser.isAdmin) {
                document.getElementById('dashboardAdminLinks').classList.remove('d-none');
            } else {
                document.getElementById('dashboardAdminLinks').classList.add('d-none');
            }
        }
        
        
        if (route === 'employees' && currentUser && currentUser.isAdmin) {
            loadEmployees();
            loadDepartmentsDropdown();
        }
        if (route === 'departments' && currentUser && currentUser.isAdmin) {
            loadDepartments();
        }
        if (route === 'accounts' && currentUser && currentUser.isAdmin) {
            loadAccounts();
        }
        if (route === 'requests' && currentUser) {
            loadRequests();
        }
    } else {
        console.log('page not found:', route);
        navigateTo('#/');
    }
}

function showPage(pageId) {
    navigateTo('#/' + pageId);
}


function renderProfile() {
    if (!currentUser) return;
    document.getElementById('profileUserName').textContent = currentUser.firstName + ' ' + currentUser.lastName;
    document.getElementById('profileEmail').textContent = currentUser.email;
    document.getElementById('profileRole').textContent = currentUser.isAdmin ? 'Admin' : 'User';

    
    var btn = document.querySelector('#profile .btn-outline-primary');
    if (btn) {
        btn.onclick = showEditProfileModal;
        btn.classList.remove('d-none');
    }
}

function showEditProfileModal() {
    alert('Edit Profile clicked — modal not implemented yet.');
}


function handleRegister(event) {
    event.preventDefault();
    
    var firstName = document.getElementById('regFirstName').value;
    var lastName = document.getElementById('regLastName').value;
    var email = document.getElementById('regEmail').value;
    var password = document.getElementById('regPassword').value;
    
    var users = window.db.accounts || [];
    
    for (var i = 0; i < users.length; i++) {
        if (users[i].email === email) {
            showError('registerError', 'Email already registered');
            return;
        }
    }
    
    
    var newUser = {
        firstName: firstName,
        lastName: lastName,
        email: email,
        password: password,
        verified: false,
        isAdmin: users.length === 0, 
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    window.db.accounts = users;
    saveToStorage();

    
    localStorage.setItem('unverified_email', email);

    document.getElementById('verifyEmailDisplay').textContent = email;
    
    navigateTo('#/verify');
    
    event.target.reset();
    hideError('registerError');
}


function simulateVerification() {
    
    var email = localStorage.getItem('unverified_email') || document.getElementById('verifyEmailDisplay').textContent;
    var users = window.db.accounts || [];

    for (var i = 0; i < users.length; i++) {
        if (users[i].email === email) {
            users[i].verified = true;
            break;
        }
    }

    
    window.db.accounts = users;
    saveToStorage();
    localStorage.removeItem('unverified_email');

    
    navigateTo('#/login');
}


function handleLogin(event) {
    event.preventDefault();
    
    var email, password, errorElement;
    
    if (event.target.closest('#login')) {
        email = document.getElementById('loginEmail').value;
        password = document.getElementById('loginPassword').value;
        errorElement = 'loginError';
    } else {
        email = document.getElementById('verifiedEmail').value;
        password = document.getElementById('verifiedPassword').value;
        errorElement = 'verifiedError';
    }
    
    var users = window.db.accounts || [];
    var user = null;
    
    
    for (var i = 0; i < users.length; i++) {
        if (users[i].email === email) {
            user = users[i];
            break;
        }
    }
    
    if (!user) {
        showError(errorElement, 'User not found');
        return;
    }
    
    if (!user.verified) {
        showError(errorElement, 'Please verify your email first');
        return;
    }
    
    if (user.password !== password) {
        showError(errorElement, 'Incorrect password');
        return;
    }
    
   
    setAuthState(true, user);

    
    navigateTo('#/profile');
    
    event.target.reset();
    hideError(errorElement);
}


function logout() {
    
    setAuthState(false);
    navigateTo('#/');
}


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
        
        var dd = document.getElementById('userDropdown');
        if (dd) {
            dd.textContent = (user.isAdmin ? 'Admin ▼' : 'User ▼');
        }
    } else {
        document.getElementById('navButtons').classList.remove('d-none');
        document.getElementById('navUser').classList.add('d-none');
        var dd = document.getElementById('userDropdown');
        if (dd) dd.textContent = 'Account ▼';
    }
}


function showError(elementId, message) {
    var element = document.getElementById(elementId);
    element.textContent = message;
    element.classList.remove('d-none');
}


function hideError(elementId) {
    var element = document.getElementById(elementId);
    element.classList.add('d-none');
}


initStorage();

if (!window.location.hash) {
    window.location.hash = '#/';
}

window.addEventListener('hashchange', handleRouting);

handleRouting();



function loadEmployees() {
    var employees = window.db.employees || [];
    var tbody = document.getElementById('employeesTableBody');
    
    if (employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No employees.</td></tr>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < employees.length; i++) {
        var emp = employees[i];
        html += '<tr>';
        html += '<td>' + emp.employeeId + '</td>';
        html += '<td>' + emp.email + '</td>';
        html += '<td>' + emp.position + '</td>';
        html += '<td>' + emp.department + '</td>';
        html += '<td>';
        html += '<button class="btn btn-primary btn-sm me-1" onclick="editEmployee(\'' + emp.employeeId + '\')">Edit</button>';
        html += '<button class="btn btn-danger btn-sm" onclick="deleteEmployee(\'' + emp.employeeId + '\')">Delete</button>';
        html += '</td>';
        html += '</tr>';
    }
    tbody.innerHTML = html;
}

function showAddEmployeeModal() {
    document.getElementById('employeeForm').reset();
    document.getElementById('employeeId').value = '';
    var modal = new bootstrap.Modal(document.getElementById('addEmployeeModal'));
    modal.show();
}

function editEmployee(employeeId) {
    var employees = window.db.employees || [];
    var employee = null;
    
    for (var i = 0; i < employees.length; i++) {
        if (employees[i].employeeId === employeeId) {
            employee = employees[i];
            break;
        }
    }
    
    if (employee) {
        document.getElementById('employeeId').value = employeeId;
        document.getElementById('employeeIdInput').value = employee.employeeId;
        document.getElementById('employeeEmail').value = employee.email;
        document.getElementById('employeePosition').value = employee.position;
        document.getElementById('employeeDepartment').value = employee.department;
        document.getElementById('employeeHireDate').value = employee.hireDate;
        
        var modal = new bootstrap.Modal(document.getElementById('addEmployeeModal'));
        modal.show();
    }
}

function saveEmployee(event) {
    event.preventDefault();
    
    var employees = window.db.employees || [];
    var oldId = document.getElementById('employeeId').value;
    
    var employee = {
        employeeId: document.getElementById('employeeIdInput').value,
        email: document.getElementById('employeeEmail').value,
        position: document.getElementById('employeePosition').value,
        department: document.getElementById('employeeDepartment').value,
        hireDate: document.getElementById('employeeHireDate').value
    };
    
    if (oldId) {
        
        for (var i = 0; i < employees.length; i++) {
            if (employees[i].employeeId === oldId) {
                employees[i] = employee;
                break;
            }
        }
    } else {
        
        employees.push(employee);
    }
    
    window.db.employees = employees;
    saveToStorage();
    bootstrap.Modal.getInstance(document.getElementById('addEmployeeModal')).hide();
    loadEmployees();
}

function deleteEmployee(employeeId) {
    if (confirm('Are you sure you want to delete this employee?')) {
        var employees = window.db.employees || [];
        var newEmployees = [];
        
        for (var i = 0; i < employees.length; i++) {
            if (employees[i].employeeId !== employeeId) {
                newEmployees.push(employees[i]);
            }
        }
        
        window.db.employees = newEmployees;
        saveToStorage();
        loadEmployees();
    }
}

function loadDepartmentsDropdown() {
    var departments = window.db.departments || [];
    var select = document.getElementById('employeeDepartment');
    var html = '<option value="">Select Department</option>';
    
    for (var i = 0; i < departments.length; i++) {
        html += '<option value="' + departments[i].name + '">' + departments[i].name + '</option>';
    }
    
    select.innerHTML = html;
}

// DEPARTMENT

function loadDepartments() {
    var departments = window.db.departments || [];
    var tbody = document.getElementById('departmentsTableBody');
    
    if (departments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">No departments.</td></tr>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < departments.length; i++) {
        var dept = departments[i];
        html += '<tr>';
        html += '<td>' + dept.name + '</td>';
        html += '<td>' + dept.description + '</td>';
        html += '<td>';
        html += '<button class="btn btn-outline-primary btn-sm me-1" onclick="editDepartment(' + dept.id + ')">Edit</button>';
        html += '<button class="btn btn-outline-danger btn-sm" onclick="deleteDepartment(' + dept.id + ')">Delete</button>';
        html += '</td>';
        html += '</tr>';
    }
    tbody.innerHTML = html;
}

function showAddDepartmentModal() {
    document.getElementById('departmentForm').reset();
    document.getElementById('departmentId').value = '';
    var modal = new bootstrap.Modal(document.getElementById('addDepartmentModal'));
    modal.show();
}

function editDepartment(id) {
    var departments = window.db.departments || [];
    var dept = null;
    
    for (var i = 0; i < departments.length; i++) {
        if (departments[i].id === id) {
            dept = departments[i];
            break;
        }
    }
    
    if (dept) {
        document.getElementById('departmentId').value = dept.id;
        document.getElementById('departmentName').value = dept.name;
        document.getElementById('departmentDescription').value = dept.description;
        
        var modal = new bootstrap.Modal(document.getElementById('addDepartmentModal'));
        modal.show();
    }
}

function saveDepartment(event) {
    event.preventDefault();
    
    var departments = window.db.departments || [];
    var id = document.getElementById('departmentId').value;
    
    var department = {
        id: id ? parseInt(id) : Date.now(),
        name: document.getElementById('departmentName').value,
        description: document.getElementById('departmentDescription').value
    };
    
    if (id) {
        
        for (var i = 0; i < departments.length; i++) {
            if (departments[i].id === parseInt(id)) {
                departments[i] = department;
                break;
            }
        }
    } else {
        
        departments.push(department);
    }
    
    window.db.departments = departments;
    saveToStorage();
    bootstrap.Modal.getInstance(document.getElementById('addDepartmentModal')).hide();
    loadDepartments();
}

function deleteDepartment(id) {
    if (confirm('Are you sure you want to delete this department?')) {
        var departments = window.db.departments || [];
        var newDepartments = [];
        
        for (var i = 0; i < departments.length; i++) {
            if (departments[i].id !== id) {
                newDepartments.push(departments[i]);
            }
        }
        
        window.db.departments = newDepartments;
        saveToStorage();
        loadDepartments();
    }
}

// ACCOUNT

function loadAccounts() {
    var users = window.db.accounts || [];
    var tbody = document.getElementById('accountsTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No accounts.</td></tr>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < users.length; i++) {
        var user = users[i];
        html += '<tr>';
        html += '<td>' + user.firstName + ' ' + user.lastName + '</td>';
        html += '<td>' + user.email + '</td>';
        html += '<td><span class="badge bg-' + (user.isAdmin ? 'danger' : 'primary') + '">' + (user.isAdmin ? 'Admin' : 'User') + '</span></td>';
        html += '<td>' + (user.verified ? '<span class="text-success">✓</span>' : '<span class="text-muted">✗</span>') + '</td>';
        html += '<td>';
        html += '<div class="d-flex flex-column gap-1" style="width: 120px;">';
        html += '<button class="btn btn-outline-primary btn-sm" onclick="editAccount(' + i + ')">Edit</button>';
        if (!user.isAdmin) {
            html += '<button class="btn btn-warning btn-sm" onclick="resetPassword(' + i + ')">Reset Password</button>';
        }
        html += '<button class="btn btn-outline-danger btn-sm" onclick="deleteAccount(' + i + ')">Delete</button>';
        html += '</div>';
        html += '</td>';
        html += '</tr>';
    }
    tbody.innerHTML = html;
}

function showAddAccountModal() {
    document.getElementById('accountForm').reset();
    document.getElementById('accountIndex').value = '';
    document.getElementById('accountPassword').setAttribute('required', 'required');
    var modal = new bootstrap.Modal(document.getElementById('addAccountModal'));
    modal.show();
}

function editAccount(index) {
    var users = window.db.accounts || [];
    var user = users[index];
    
    if (user) {
        document.getElementById('accountIndex').value = index;
        document.getElementById('accountFirstName').value = user.firstName;
        document.getElementById('accountLastName').value = user.lastName;
        document.getElementById('accountEmail').value = user.email;
        document.getElementById('accountPassword').value = '';
        document.getElementById('accountPassword').removeAttribute('required');
        document.getElementById('accountRole').value = user.isAdmin ? 'Admin' : 'User';
        document.getElementById('accountVerified').checked = user.verified;
        
        var modal = new bootstrap.Modal(document.getElementById('addAccountModal'));
        modal.show();
    }
}

function saveAccount(event) {
    event.preventDefault();
    
    var users = window.db.accounts || [];
    var index = document.getElementById('accountIndex').value;
    
    var account = {
        firstName: document.getElementById('accountFirstName').value,
        lastName: document.getElementById('accountLastName').value,
        email: document.getElementById('accountEmail').value,
        isAdmin: document.getElementById('accountRole').value === 'Admin',
        verified: document.getElementById('accountVerified').checked,
        createdAt: index !== '' ? users[index].createdAt : new Date().toISOString()
    };
    
    var password = document.getElementById('accountPassword').value;
    if (password) {
        account.password = password;
    } else if (index !== '') {
        account.password = users[index].password;
    }
    
    if (index !== '') {
        
        users[index] = account;
    } else {
        
        users.push(account);
    }
    
    window.db.accounts = users;
    saveToStorage();

    
    if (currentUser && index !== '' && users[index].email === currentUser.email) {
        
        setAuthState(true, users[index]);
    }
    
    bootstrap.Modal.getInstance(document.getElementById('addAccountModal')).hide();
    loadAccounts();
}

function resetPassword(index) {
    var newPassword = prompt('Enter new password (min 6 characters):');
    if (newPassword && newPassword.length >= 6) {
        var users = window.db.accounts || [];
        users[index].password = newPassword;
        window.db.accounts = users;
        saveToStorage();
        alert('Password reset successfully!');
    }
}

function deleteAccount(index) {
    var users = window.db.accounts || [];
    
    if (currentUser && users[index].email === currentUser.email) {
        alert('You cannot delete your own account!');
        return;
    }
    
    if (confirm('Are you sure you want to delete this account?')) {
        users.splice(index, 1);
        window.db.accounts = users;
        saveToStorage();
        loadAccounts();
    }
}

// REQUESTS 

function loadRequests() {
    var requests = window.db.requests || [];
    var userRequests = [];
    
    
    for (var i = 0; i < requests.length; i++) {
        if (requests[i].employeeEmail === currentUser.email) {
            userRequests.push(requests[i]);
        }
    }
    
    var emptyState = document.getElementById('requestsEmptyState');
    var table = document.getElementById('requestsTable');
    var tbody = document.getElementById('requestsTableBody');
    
    if (userRequests.length === 0) {
        emptyState.classList.remove('d-none');
        table.classList.add('d-none');
        return;
    }
    
    emptyState.classList.add('d-none');
    table.classList.remove('d-none');
    
    var html = '';
    for (var i = 0; i < userRequests.length; i++) {
        var req = userRequests[i];
        var badgeClass = 'warning';
        if (req.status === 'Approved') badgeClass = 'success';
        if (req.status === 'Rejected') badgeClass = 'danger';
        
        html += '<tr>';
        html += '<td>#' + req.id + '</td>';
        html += '<td>' + req.type + '</td>';
        html += '<td>' + req.items.length + ' item(s)</td>';
        html += '<td><span class="badge bg-' + badgeClass + '">' + req.status + '</span></td>';
        html += '<td>' + new Date(req.date).toLocaleDateString() + '</td>';
        html += '<td>';
        html += '<button class="btn btn-info btn-sm" onclick="viewRequest(' + req.id + ')">View</button>';
        if (req.status === 'Pending') {
            html += '<button class="btn btn-danger btn-sm" onclick="deleteRequest(' + req.id + ')">Delete</button>';
        }
        html += '</td>';
        html += '</tr>';
    }
    tbody.innerHTML = html;
}

function showNewRequestModal() {
    document.getElementById('requestForm').reset();
    document.getElementById('requestItemsList').innerHTML = '<div class="input-group mb-2"><input type="text" class="form-control" placeholder="Item name" required><input type="number" class="form-control" style="max-width: 80px;" value="1" min="1"><button type="button" class="btn btn-outline-danger" onclick="removeRequestItem(this)">×</button></div>';
    var modal = new bootstrap.Modal(document.getElementById('newRequestModal'));
    modal.show();
}

function addRequestItem() {
    var container = document.getElementById('requestItemsList');
    var newItem = document.createElement('div');
    newItem.className = 'input-group mb-2';
    newItem.innerHTML = '<input type="text" class="form-control" placeholder="Item name" required><input type="number" class="form-control" style="max-width: 80px;" value="1" min="1"><button type="button" class="btn btn-outline-danger" onclick="removeRequestItem(this)">×</button>';
    container.appendChild(newItem);
}

function removeRequestItem(button) {
    var container = document.getElementById('requestItemsList');
    if (container.children.length > 1) {
        button.closest('.input-group').remove();
    }
}

function saveRequest(event) {
    event.preventDefault();
    
    var requests = window.db.requests || [];
    var type = document.getElementById('requestType').value;
    
    
    var itemsContainer = document.getElementById('requestItemsList');
    var itemGroups = itemsContainer.querySelectorAll('.input-group');
    var items = [];
    
    for (var i = 0; i < itemGroups.length; i++) {
        var inputs = itemGroups[i].querySelectorAll('input');
        items.push({
            name: inputs[0].value,
            quantity: parseInt(inputs[1].value)
        });
    }
    
    var request = {
        id: Date.now(),
        employeeEmail: currentUser.email,
        type: type,
        items: items,
        status: 'Pending',
        date: new Date().toISOString()
    };
    
    requests.push(request);
    window.db.requests = requests;
    saveToStorage();
    
    bootstrap.Modal.getInstance(document.getElementById('newRequestModal')).hide();
    loadRequests();
}

function viewRequest(id) {
    var requests = window.db.requests || [];
    var request = null;
    
    for (var i = 0; i < requests.length; i++) {
        if (requests[i].id === id) {
            request = requests[i];
            break;
        }
    }
    
    if (request) {
        var itemsList = '';
        for (var i = 0; i < request.items.length; i++) {
            if (i > 0) itemsList += ', ';
            itemsList += request.items[i].name + ' (x' + request.items[i].quantity + ')';
        }
        alert('Request #' + request.id + '\nType: ' + request.type + '\nItems: ' + itemsList + '\nStatus: ' + request.status + '\nDate: ' + new Date(request.date).toLocaleString());
    }
}

function deleteRequest(id) {
    if (confirm('Are you sure you want to delete this request?')) {
        var requests = window.db.requests || [];
        var newRequests = [];
        
        for (var i = 0; i < requests.length; i++) {
            if (requests[i].id !== id) {
                newRequests.push(requests[i]);
            }
        }
        
        window.db.requests = newRequests;
        saveToStorage();
        loadRequests();
    }
}