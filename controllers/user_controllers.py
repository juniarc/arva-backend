from flask import Blueprint, request, jsonify
from models.users import User
from flask_jwt_extended import create_access_token , get_jwt_identity, jwt_required, get_jwt
from connector.db import db
import datetime


user_bp = Blueprint('user_controller', __name__)

@user_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    elif 'username' not in data:
        return jsonify({'error': 'Missing username'}), 400
    elif 'email' not in data:
        return jsonify({'error': 'Missing email'}), 400
    elif 'password' not in data:
        return jsonify({'error': 'Missing password'}), 400
    elif 'phone_number' not in data:
        return jsonify({'error': 'Missing phone number'}), 400
    elif 'role' not in data:
        return jsonify({'error': 'Missing role'}), 400


    try:
        user = User(username=data['username'], email=data['email'], phone_number=data['phone_number'], role=data['role'])
        user.set_password(data['password'])
        db.session.add(user)
        db.session.commit()
        return jsonify({'message': 'User registered successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to register user {e}'}), 500

@user_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    elif 'email' not in data:
        return jsonify({'error': 'Missing email'}), 400 
    elif 'password' not in data:
        return jsonify({'error': 'Missing password'}), 400

    
    try:
        user = db.session.query(User).filter_by(email=data['email']).first()
        user_id = str(user.user_id)
       
        if user is None:
            return jsonify({'error': 'User not found'}), 404
        if not user.check_password(data['password']):
            return jsonify({'error': 'Incorrect password'}), 401
        if user and user.check_password(data['password']):
            expires = datetime.timedelta(days=1)
            access_token = create_access_token(identity=user_id, additional_claims={
                'username': user.username,
                'email': user.email,
                'role': user.role}, expires_delta=expires)

            return jsonify({'message': f'User {user.username} Logged in successfully',
                'access_token': access_token,
                'user_id': user_id}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to login {e}'}), 500
        
@user_bp.route('/allusers', methods=['GET'])
def get_all_users():

    try:
        users = db.session.query(User).all()
        return jsonify([user.to_dict() for user in users]), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get all users {e}'}), 500

@user_bp.route('/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    
    current_user_id = int(get_jwt_identity())
    jwt_payload = get_jwt()
    user_role = jwt_payload.get('role')
    print(user_role)    
    
    if user_role == 'admin' or current_user_id == user_id:
        try:
            user = db.session.query(User).filter_by(user_id=user_id).first()
            if user is None:
                return jsonify({'error': 'User not found'}), 404
            return jsonify(user.to_dict()), 200
        except Exception as e:
            return jsonify({'error': 'Failed to get user'}), 500      

    return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401

@user_bp.route('/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    data = request.get_json()

    current_user_id = int(get_jwt_identity())
    jwt_payload = get_jwt()
    user_role = jwt_payload.get('role')

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    
    if user_role == 'admin' or current_user_id == user_id:
        try:
            user = db.session.query(User).filter_by(user_id=user_id).first()
            if user is None:
                return jsonify({'error': 'User not found'}), 404
            user.username = data.get('username', user.username)
            user.name = data.get('name', user.name)
            user.email = data.get('email', user.email)
            user.phone_number = data.get('phone_number', user.phone_number)
            user.address_street = data.get('address_street', user.address_street)
            user.address_province = data.get('address_province', user.address_province)
            user.address_city = data.get('address_city', user.address_city)
            user.address_district = data.get('address_district', user.address_district)
            user.address_subdistrict = data.get('address_subdistrict', user.address_subdistrict)
            user.zip_code = data.get('zip_code', user.zip_code)
            user.profile_image = data.get('profile_image', user.profile_image)
            db.session.commit()
            return jsonify({'message': 'User updated successfully'}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'Failed to update user'}), 500
        
    return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401




@user_bp.route('/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):

    current_user_id = int(get_jwt_identity())
    jwt_payload = get_jwt()
    user_role = jwt_payload.get('role')

    if user_role == 'admin' or current_user_id == user_id:
        try:
            user = db.session.query(User).filter_by(user_id=user_id).first()
            if user is None:
                return jsonify({'error': 'User not found'}), 404
            db.session.delete(user)  
            db.session.commit()
            return jsonify({'message': 'User deleted successfully'}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'Failed to delete user'}), 500
    return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401


#change password
@user_bp.route('/<int:user_id>/change-password', methods=['PUT'])
@jwt_required()
def change_password(user_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())

    if 'password' not in data:
        return jsonify({'error': 'Missing password'}), 400
    
    if 'new_password' not in data:
        return jsonify({'error': 'Missing new password'}), 400

    if current_user_id != user_id:
        return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
    
    try:
        user = db.session.query(User).filter_by(user_id=user_id).first()
        if user is None:
            return jsonify({'error': 'User not found'}), 404
        if user.check_password(data['password']):
            user.set_password(data['new_password'])
            db.session.commit()
            return jsonify({'message': 'Password changed successfully'}), 200
        else:
            return jsonify({'error': 'Incorrect old password'}), 401
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to change password'}), 500
    



