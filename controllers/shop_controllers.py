from flask import jsonify, request, Blueprint
from connector.db import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from models.shops import Shop
import datetime


shop_bp = Blueprint('shop_controller', __name__)


@shop_bp.route('/<int:user_id>', methods=['GET'])
@jwt_required()
def get_shop(user_id):
    current_user_id = int(get_jwt_identity())
    jwt_payload = get_jwt()
    user_role = jwt_payload.get('role')

    if user_role == 'admin' or current_user_id == user_id:
        try:
            shop = db.session.query(Shop).filter_by(user_id=user_id).first()
            if shop is None:
                return jsonify({'error': 'Shop not found'}), 404
            if shop.status != 'active':
                return jsonify({'error':'Shop is not actived'})
            return jsonify(shop.to_dict()), 200
        except Exception as e:
            return jsonify({'error': 'Failed to get shop'}), 500
    return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401


@shop_bp.route('/allshops', methods=['GET'])
def get_all_shops():
    try:
        shops = db.session.query(Shop).all()
        return jsonify([shop.to_dict() for shop in shops]), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get all shops'}), 500
    
@shop_bp.route('/<int:user_id>', methods=['POST'])
@jwt_required()
def create_shop(user_id):
    data = request.get_json()

    current_user_id = int(get_jwt_identity())
    
    if data is None:
        return jsonify({'error': 'No data provided'})
    elif 'shop_name' not in data:
        return jsonify({'error': 'Missing Shop name'})
    elif 'shop_address_street' not in data:
        return jsonify({'error': "Missing address: street"})
    elif 'shop_address_province' not in data:
        return jsonify({'error': 'Missing address: province'})
    elif 'shop_address_city' not in data:
        return jsonify({'error': 'Missing address: city'})
    elif 'shop_address_district' not in data:
        return jsonify({'error': 'Missing address: district'})
    elif 'shop_address_subdistrict' not in data:
        return jsonify({'error': 'Misssing address: subdistrict'})
    
    if current_user_id != user_id:
        return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401

    try:
        new_shop = Shop(
            shop_name=data['shop_name'],
            description=data.get('description'),
            shop_image=data.get('shop_image'),
            shop_address_street=data['shop_address_street'],
            shop_address_province=data['shop_address_province'],
            shop_address_city=data['shop_address_city'],
            shop_address_district=data['shop_address_district'],
            shop_address_subdistrict=data['shop_address_subdistrict'],
            user_id=user_id,
            status= 'active'
        )
        db.session.add(new_shop)
        db.session.commit()
        return jsonify({'message': 'Shop created successfully'}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to create shop'}), 500
    

@shop_bp.route('/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_shop(user_id):
    data = request.get_json()

    current_user_id = int(get_jwt_identity())
    
    if data is None:
        return jsonify({'error': 'No data provided'})

    
    if current_user_id != user_id:
        return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401

    try:
        shop = db.session.query(Shop).filter_by(user_id=user_id).first()
        if shop is None:
            return jsonify({'error': 'Shop not found'}), 404
        shop.shop_name = data.get('shop_name', shop.shop_name)
        shop.description = data.get('description', shop.description)
        shop.shop_image = data.get('shop_image', shop.shop_image)
        shop.shop_address_street = data.get('shop_address_street', shop.shop_address_street)
        shop.shop_address_province = data.get('shop_address_province', shop.shop_address_province)
        shop.shop_address_city = data.get('shop_address_city', shop.shop_address_city)
        shop.shop_address_district = data.get('shop_address_district', shop.shop_address_district)
        shop.shop_address_subdistrict = data.get('shop_address_subdistrict', shop.shop_address_subdistrict)
        db.session.commit()
        return jsonify({'message': 'Shop updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to update shop {e}'}), 500
    

# @shop_bp.route('/<int:user_id>', methods=['DELETE'])
# @jwt_required()
# def delete_shop(user_id):
    
#     jwt_payload = get_jwt()
#     user_role = jwt_payload.get('role')
    
#     if user_role != 'admin':
#         return jsonify({'error': 'Unauthorized: This action is not allowed'}), 401
    
#     try:
#         shop = db.session.query(Shop).filter_by(user_id=user_id).first()
#         if shop is None:
#             return jsonify({'error': 'Shop not found'}), 404
#         db.session.delete(shop)
#         db.session.commit()
#         return jsonify({'message': 'Shop deleted successfully'}), 200
#     except Exception as e:
#         return jsonify({'error': 'Failed to delete shop'}), 500

@shop_bp.route('/<int:user_id>/deactivate', methods=['PUT'])
@jwt_required()
def deactivate_shop(user_id):
    data = request.get_json()
    status = data['status']
    
    current_user_id = int(get_jwt_identity())
    jwt_payload = get_jwt()
    user_role = jwt_payload.get('role')
    
 
    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    elif  'status' not in data:
        return jsonify({'error': 'Missing: status'}), 400
    
    if user_role == 'admin' or current_user_id == user_id:
        try:
            shop = db.session.query(Shop).filter_by(user_id=user_id).first()
            if shop is None:
                return jsonify({'error': 'Shop not found'}), 404
            shop.status = status
            db.session.commit()
            return jsonify({'message': 'Shop deactivated successfully'}), 200
        except Exception as e:
            return jsonify({'error': 'Failed to deactivate shop'}), 500
    return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401                                           

    


