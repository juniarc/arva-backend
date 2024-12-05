from flask import jsonify, request, Blueprint
from connector.db import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from models.products import Product
from models.variant import Variant
import datetime


variant_bp = Blueprint('variant_controller', __name__)


@variant_bp.route('/allvariantbyproductid/<int:product_id>', methods=['GET'])
def get_allvariant_productid(product_id):
    try:
        variants = db.session.query(Variant).filter_by(product_id=product_id).all()
        return jsonify([variant.to_dict() for variant in variants]), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get variant'}), 500

@variant_bp.route('/<int:variant_id>', methods=['GET'])
def get_variant(variant_id):
    try:
        variant = db.session.query(Variant).filter_by(variant_id=variant_id).first()
        if variant is None:
            return jsonify({'error': 'Variant not found'}), 404
        return jsonify(variant.to_dict()), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get variant'}), 500

@variant_bp.route('/allvariant', methods=['GET'])
def get_all_variant():
    try:
        variants = db.session.query(Variant).all()
        return jsonify([variant.to_dict() for variant in variants]), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get all variants'}), 500
    
@variant_bp.route('/createvariant/<int:product_id>', methods=['POST'])
@jwt_required()
def create_variant(product_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    elif 'variant_name' not in data:
        return jsonify({'error': 'Missing variant name'}), 400
    elif 'price' not in data:
        return jsonify({'error': 'Missing price'}), 400
    elif 'stock' not in data:
        return jsonify({'error': 'Missing stock'}), 400
    
    try:
        product = db.session.query(Product).filter_by(product_id=product_id).first()
        if product is None:
            return jsonify({'error': 'Product not found'}), 404
        if product.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        new_variant = Variant(
            variant_name=data['variant_name'],
            price=data['price'],
            stock=data['stock'],
            product_id=product_id
        )
        db.session.add(new_variant)
        db.session.commit()
        return jsonify({'message': 'Variant created successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create variant'}), 500
    
@variant_bp.route('/updatevariant/<int:variant_id>', methods=['PUT'])
@jwt_required()
def update_variant(variant_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        variant = db.session.query(Variant).filter_by(variant_id=variant_id).first()
        if variant is None:
            return jsonify({'error': 'Variant not found'}), 404
        if variant.product.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        variant.variant_name = data.get('variant_name', variant.variant_name)
        variant.price = data.get('price', variant.price)
        variant.stock = data.get('stock', variant.stock)
        db.session.commit()
        return jsonify({'message': 'Variant updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update variant'}), 500
    
@variant_bp.route('/deletevariant/<int:variant_id>', methods=['DELETE'])
@jwt_required()
def delete_variant(variant_id):
    current_user_id = int(get_jwt_identity())
    try:
        variant = db.session.query(Variant).filter_by(variant_id=variant_id).first()
        if variant is None:
            return jsonify({'error': 'Variant not found'}), 404
        if variant.product.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        db.session.delete(variant)
        db.session.commit()
        return jsonify({'message': 'Variant deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete variant'}), 500